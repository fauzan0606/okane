import { NextResponse } from "next/server";
import { ReconciliationSourceType } from "@prisma/client";
import {
  createReconciliationSession,
  type ExtractedRow,
} from "@/modules/reconciliation/service";

export const runtime = "nodejs";

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
] as const;

const GENERATE_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const UPLOAD_URL =
  "https://generativelanguage.googleapis.com/upload/v1beta/files";

const MAX_GENERATION_ATTEMPTS_PER_MODEL = 3;

type JsonRecord = Record<string, unknown>;

type GeminiRawRow = {
  sourceRowNumber?: number;
  pageNumber?: number;
  transactionDate?: string;
  description?: string;
  amount?: number;
  direction?: "DEBIT" | "CREDIT" | "UNKNOWN";
  entryType?: string;
};

type GeminiExtractionResponse = {
  periodStart?: string;
  periodEnd?: string;
  rows?: GeminiRawRow[];
  candidates?: GeminiCandidate[];
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
};

type GeminiPart = {
  text?: string;
};

const responseSchema = {
  type: "object",
  properties: {
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sourceRowNumber: { type: "number" },
          pageNumber: { type: "number" },
          transactionDate: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
          direction: {
            type: "string",
            enum: [
              "DEBIT",
              "CREDIT",
              "UNKNOWN",
            ],
          },
          entryType: { type: "string" },
        },
        required: [
          "transactionDate",
          "description",
          "amount",
          "direction",
          "entryType",
        ],
      },
    },
  },
  required: ["rows"],
};

function error(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    { error: message },
    { status },
  );
}

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function safeProviderDetail(
  body: string,
) {
  try {
    const parsed = JSON.parse(
      body,
    ) as JsonRecord;

    const errorValue =
      isRecord(parsed.error)
        ? parsed.error
        : undefined;

    const message =
      typeof errorValue?.message ===
      "string"
        ? errorValue.message
        : undefined;

    const status =
      typeof errorValue?.status ===
      "string"
        ? errorValue.status
        : undefined;

    return (
      message ||
      status ||
      "Unknown Gemini error"
    );
  } catch {
    return body
      .replace(/\s+/g, " ")
      .slice(0, 400);
  }
}

function normalize(
  raw: unknown,
): {
  periodStart?: string;
  periodEnd?: string;
  rows: ExtractedRow[];
} {
  const data: JsonRecord = isRecord(
    raw,
  )
    ? raw
    : {};

  const rawRows = Array.isArray(
    data.rows,
  )
    ? data.rows
    : [];

  const rows: ExtractedRow[] =
    rawRows
      .map(
        (
          value: unknown,
        ): ExtractedRow | null => {
          const row: JsonRecord =
            isRecord(value)
              ? value
              : {};

          const sourceRowNumberValue =
            Number(
              row.sourceRowNumber,
            );

          const pageNumberValue =
            Number(row.pageNumber);

          const transactionDate =
            String(
              row.transactionDate ??
                "",
            ).slice(0, 40);

          const description =
            String(
              row.description ?? "",
            ).trim();

          const amount = Math.abs(
            Number(row.amount) || 0,
          );

          const direction =
            row.direction ===
              "CREDIT" ||
            row.direction ===
              "DEBIT"
              ? row.direction
              : "UNKNOWN";

          const entryType =
            String(
              row.entryType ??
                "UNKNOWN",
            ).trim();

          if (
            !transactionDate ||
            !description ||
            amount <= 0
          ) {
            return null;
          }

          return {
            sourceRowNumber:
              Number.isFinite(
                sourceRowNumberValue,
              )
                ? sourceRowNumberValue
                : undefined,
            pageNumber:
              Number.isFinite(
                pageNumberValue,
              )
                ? pageNumberValue
                : undefined,
            transactionDate,
            description,
            amount,
            direction,
            entryType,
          };
        },
      )
      .filter(
        (
          row,
        ): row is ExtractedRow =>
          row !== null,
      );

  return {
    periodStart:
      data.periodStart
        ? String(
            data.periodStart,
          ).slice(0, 40)
        : undefined,

    periodEnd:
      data.periodEnd
        ? String(
            data.periodEnd,
          ).slice(0, 40)
        : undefined,

    rows,
  };
}

async function sleepWithJitter(
  attempt: number,
) {
  const baseDelayMs =
    1000 * 2 ** attempt;

  const jitterMs = Math.floor(
    Math.random() * 350,
  );

  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        baseDelayMs + jitterMs,
      ),
  );
}

async function uploadToGeminiFiles(
  apiKey: string,
  file: File,
) {
  const bytes = Buffer.from(
    new Uint8Array(
      await file.arrayBuffer(),
    ),
  );

  const startResponse =
    await fetch(
      `${UPLOAD_URL}?key=${encodeURIComponent(
        apiKey,
      )}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol":
            "resumable",
          "X-Goog-Upload-Command":
            "start",
          "X-Goog-Upload-Header-Content-Length":
            String(bytes.length),
          "X-Goog-Upload-Header-Content-Type":
            "application/pdf",
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          file: {
            display_name: file.name,
          },
        }),
      },
    );

  if (!startResponse.ok) {
    const body =
      await startResponse.text();

    console.error(
      "Gemini Files API start failed",
      startResponse.status,
      body,
    );

    throw new Error(
      `Gemini Files API could not start the PDF upload (${startResponse.status}): ${safeProviderDetail(
        body,
      )}`,
    );
  }

  const uploadUrl =
    startResponse.headers.get(
      "x-goog-upload-url",
    );

  if (!uploadUrl) {
    throw new Error(
      "Gemini Files API did not return an upload URL.",
    );
  }

  const uploadResponse =
    await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length":
          String(bytes.length),
        "X-Goog-Upload-Offset":
          "0",
        "X-Goog-Upload-Command":
          "upload, finalize",
        "Content-Type":
          "application/pdf",
      },
      body: bytes,
    });

  if (!uploadResponse.ok) {
    const body =
      await uploadResponse.text();

    console.error(
      "Gemini Files API upload failed",
      uploadResponse.status,
      body,
    );

    throw new Error(
      `Gemini Files API could not upload the PDF (${uploadResponse.status}): ${safeProviderDetail(
        body,
      )}`,
    );
  }

  const uploaded =
    (await uploadResponse.json()) as {
      file?: {
        name?: string;
        uri?: string;
        mimeType?: string;
        state?: string;
      };
    };

  const fileName =
    uploaded.file?.name;

  const fileUri =
    uploaded.file?.uri;

  if (!fileName || !fileUri) {
    throw new Error(
      "Gemini Files API returned an incomplete file resource.",
    );
  }

  let state =
    uploaded.file?.state ||
    "ACTIVE";

  for (
    let attempt = 0;
    attempt < 10 &&
    state === "PROCESSING";
    attempt += 1
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(resolve, 1000),
    );

    const statusResponse =
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${encodeURIComponent(
          apiKey,
        )}`,
      );

    if (!statusResponse.ok) {
      const body =
        await statusResponse.text();

      throw new Error(
        `Gemini Files API could not check PDF status (${statusResponse.status}): ${safeProviderDetail(
          body,
        )}`,
      );
    }

    const status =
      (await statusResponse.json()) as {
        state?: string;
        error?: {
          message?: string;
        };
      };

    state =
      status.state ||
      "ACTIVE";

    if (state === "FAILED") {
      throw new Error(
        `Gemini could not process the PDF: ${
          status.error?.message ||
          "file processing failed"
        }`,
      );
    }
  }

  if (state !== "ACTIVE") {
    throw new Error(
      `Gemini PDF processing did not complete (state: ${state}).`,
    );
  }

  return {
    fileName,
    fileUri,
    mimeType:
      uploaded.file?.mimeType ||
      "application/pdf",
  };
}

function extractResponseText(
  data: GeminiExtractionResponse,
) {
  const candidate =
    data.candidates?.[0];

  const parts =
    candidate?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map(
      (
        part: GeminiPart,
      ) =>
        part.text ?? "",
    )
    .join("")
    .trim();
}

function isRetryableStatus(
  status: number,
) {
  return (
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

async function generateWithModel(
  apiKey: string,
  model: string,
  prompt: string,
  fileData: {
    fileUri: string;
    mimeType: string;
  },
) {
  const generateUrl =
    `${GENERATE_BASE_URL}/${model}:generateContent`;

  let lastError =
    "Unknown Gemini error";

  let lastStatus = 502;

  for (
    let attempt = 0;
    attempt <
      MAX_GENERATION_ATTEMPTS_PER_MODEL;
    attempt += 1
  ) {
    const response =
      await fetch(
        `${generateUrl}?key=${encodeURIComponent(
          apiKey,
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                  {
                    file_data: {
                      mime_type:
                        fileData.mimeType,
                      file_uri:
                        fileData.fileUri,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType:
                "application/json",
              responseJsonSchema:
                responseSchema,
              maxOutputTokens:
                32768,
            },
          }),
        },
      );

    if (response.ok) {
      let data: GeminiExtractionResponse;

      try {
        data =
          (await response.json()) as GeminiExtractionResponse;
      } catch {
        throw new Error(
          "Gemini returned an invalid response while analyzing the statement.",
        );
      }

      return data;
    }

    const body =
      await response.text();

    lastStatus =
      response.status;

    lastError =
      safeProviderDetail(body);

    console.error(
      "Gemini statement extraction failed",
      {
        model,
        attempt:
          attempt + 1,
        status:
          response.status,
        detail:
          lastError,
      },
    );

    if (
      !isRetryableStatus(
        response.status,
      )
    ) {
      const errorValue =
        new Error(lastError) as Error & {
          status?: number;
          model?: string;
        };

      errorValue.status =
        response.status;

      errorValue.model =
        model;

      throw errorValue;
    }

    if (
      attempt <
      MAX_GENERATION_ATTEMPTS_PER_MODEL -
        1
    ) {
      await sleepWithJitter(
        attempt,
      );
    }
  }

  const errorValue =
    new Error(lastError) as Error & {
      status?: number;
      model?: string;
    };

  errorValue.status =
    lastStatus;

  errorValue.model =
    model;

  throw errorValue;
}

async function generateWithFallbacks(
  apiKey: string,
  prompt: string,
  fileData: {
    fileUri: string;
    mimeType: string;
  },
) {
  let lastError:
    | Error
    | null = null;

  for (const model of MODELS) {
    try {
      const data =
        await generateWithModel(
          apiKey,
          model,
          prompt,
          fileData,
        );

      return {
        data,
        model,
      };
    } catch (err) {
      lastError =
        err instanceof Error
          ? err
          : new Error(
              "Unknown Gemini error",
            );

      const status =
        (
          lastError as Error & {
            status?: number;
          }
        ).status;

      if (
        !status ||
        !isRetryableStatus(
          status,
        )
      ) {
        throw lastError;
      }

      console.warn(
        `Gemini model ${model} remained unavailable after retries. Falling back to next model.`,
      );
    }
  }

  throw (
    lastError ??
    new Error(
      "No Gemini model was available to process the statement.",
    )
  );
}

export async function POST(
  request: Request,
) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return error(
      "GEMINI_API_KEY is not configured on the server.",
      500,
    );
  }

  const formData =
    await request.formData();

  const file =
    formData.get("file");

  const walletId =
    formData.get("walletId");

  const sourceType =
    formData.get("sourceType");

  if (!(file instanceof File)) {
    return error(
      "PDF statement is required.",
    );
  }

  const isPdf =
    file.type ===
      "application/pdf" ||
    file.name
      .toLowerCase()
      .endsWith(".pdf");

  if (!isPdf) {
    return error(
      "Please upload a PDF statement.",
    );
  }

  if (
    file.size >
    50 * 1024 * 1024
  ) {
    return error(
      "PDF statements must be 50 MB or smaller.",
    );
  }

  if (
    typeof walletId !==
      "string" ||
    !walletId
  ) {
    return error(
      "Wallet is required.",
    );
  }

  if (
    sourceType !==
      "BANK_STATEMENT" &&
    sourceType !==
      "CREDIT_CARD_STATEMENT"
  ) {
    return error(
      "Statement type is required.",
    );
  }

  const prompt = `You are extracting a bank or credit-card statement into normalized transaction rows for a personal finance reconciliation system.

Statement type: ${sourceType}.

Rules:
- Extract every actual transaction row from the statement, not headers, balances, totals, rewards summaries, statement metadata, or page footers.
- Preserve the transaction date printed for the transaction. Do not substitute statement date or posting date.
- Preserve the description as printed, including merchant/reference text.
- Amount must be the absolute numeric transaction amount without currency symbols or separators.
- direction DEBIT means money/spending charged from the selected wallet; CREDIT means money/refund/credit posted to it; UNKNOWN when the statement does not make the direction reliable.
- entryType should be one concise classification such as PURCHASE, REFUND, PAYMENT, FEE, INTEREST, TRANSFER, CASH_ADVANCE, REWARD, or UNKNOWN.
- For credit-card statements, payment lines are PAYMENT and must not be treated as purchases or expenses.
- Return pageNumber when visible or inferable from the document page. sourceRowNumber should be the visible transaction sequence/row number if present; otherwise use a best-effort sequential row number across transaction rows.
- Do not invent transactions.
- Extract the statement period when visible, but only return a period value that is a valid ISO 8601 date (YYYY-MM-DD). If the period cannot be expressed as a valid date, omit it.
- Keep duplicate-looking rows when they are separate statement rows.
- Return only JSON matching the supplied schema.`;

  let uploadedFile: {
    fileName: string;
    fileUri: string;
    mimeType: string;
  };

  try {
    uploadedFile =
      await uploadToGeminiFiles(
        apiKey,
        file,
      );
  } catch (err) {
    console.error(err);

    return error(
      err instanceof Error
        ? err.message
        : "Could not upload the statement to Gemini.",
      502,
    );
  }

  let generated: {
    data: GeminiExtractionResponse;
    model: string;
  };

  try {
    generated =
      await generateWithFallbacks(
        apiKey,
        prompt,
        uploadedFile,
      );
  } catch (err) {
    console.error(
      "All Gemini reconciliation models failed",
      err,
    );

    const message =
      err instanceof Error
        ? err.message
        : "Unknown Gemini error";

    const status =
      (
        err as Error & {
          status?: number;
        }
      ).status;

    if (status === 429) {
      return error(
        "Gemini is temporarily rate-limited. Please try again in a moment.",
        429,
      );
    }

    if (status === 503) {
      return error(
        "Gemini is temporarily busy across the configured models. Please try again in a moment.",
        503,
      );
    }

    if (
      status === 401 ||
      status === 403
    ) {
      return error(
        "Gemini API key is invalid or cannot access the configured models.",
        502,
      );
    }

    return error(
      `Gemini could not process this statement: ${message}`,
      502,
    );
  }

  console.info(
    `Reconciliation statement extracted with ${generated.model}`,
  );

  const text =
    extractResponseText(
      generated.data,
    );

  if (!text) {
    const finishReason =
      generated.data
        .candidates?.[0]
        ?.finishReason;

    return error(
      `Gemini returned no extracted rows${
        finishReason
          ? ` (finish reason: ${finishReason})`
          : ""
      }.`,
      502,
    );
  }

  try {
    const normalized =
      normalize(
        JSON.parse(text) as unknown,
      );

    if (!normalized.rows.length) {
      return error(
        "No transaction rows were confidently extracted from this statement.",
      );
    }

    const session =
      await createReconciliationSession({
        walletId,
        sourceType:
          sourceType as ReconciliationSourceType,
        fileName: file.name,
        rows: normalized.rows,
        periodStart:
          normalized.periodStart,
        periodEnd:
          normalized.periodEnd,
      });

    return NextResponse.json({
      sessionId: session.id,
      extractedCount:
        normalized.rows.length,
      model: generated.model,
    });
  } catch (err) {
    console.error(err);

    return error(
      err instanceof Error
        ? err.message
        : "Could not create reconciliation session.",
      400,
    );
  }
}