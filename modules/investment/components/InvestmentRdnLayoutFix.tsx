"use client";

import { useEffect } from "react";

function findRdnSection() {
  return Array.from(document.querySelectorAll<HTMLElement>("section")).find(
    (section) => section.querySelector("h2")?.textContent?.trim() === "RDN Cash"
  ) ?? null;
}

function findGridAncestor(node: HTMLElement) {
  let current: HTMLElement | null = node.parentElement;
  while (current && current !== document.body) {
    if (typeof current.className === "string" && /(^|\s)grid(\s|$)/.test(current.className)) {
      return current;
    }
    current = current.parentElement;
  }
  return node.parentElement;
}

function relocate() {
  const target = findRdnSection();
  if (!target) return;

  // The portal initially mounts inside RDN Cash. Move the real host outside
  // the original two-card grid, while leaving a marker so the portal does not
  // recreate another host on the next mutation.
  const mount = target.querySelector<HTMLElement>("[data-rdn-withdraw-mount]");
  if (!mount) return;

  const grid = findGridAncestor(target);
  const hostParent = grid?.parentElement;
  if (!grid || !hostParent) return;
  if (mount.parentElement === hostParent) return;

  let marker = target.querySelector<HTMLElement>("[data-rdn-withdraw-mount-marker]");
  if (!marker) {
    marker = document.createElement("span");
    marker.dataset.rdnWithdrawMountMarker = "1";
    marker.style.display = "none";
    target.appendChild(marker);
  }

  hostParent.insertBefore(mount, grid.nextSibling);
}

export default function InvestmentRdnLayoutFix() {
  useEffect(() => {
    const run = () => window.requestAnimationFrame(relocate);
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
