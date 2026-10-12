"use client"

import { useSyncExternalStore } from "react"

/** Versions de DA testées avec le client (propre au prototype) */
export const DA_VERSIONS = [
  { id: "bleu", label: "Boutons bleus" },
  { id: "noir", label: "Boutons noirs, détails bleus" },
] as const

export type DaVersion = (typeof DA_VERSIONS)[number]["id"]

const KEY = "nereids-da"

/**
 * Script inline (layout) : applique la version avant le premier rendu, sans flash.
 * Priorité : ?da=… dans l'URL (lien partageable) > choix mémorisé > « bleu ».
 */
export const DA_INIT_SCRIPT = `(function(){try{var q=new URLSearchParams(location.search).get("da");var v=q==="noir"||q==="bleu"?q:localStorage.getItem("${KEY}");if(q)localStorage.setItem("${KEY}",q);document.documentElement.dataset.da=v==="noir"?"noir":"bleu"}catch(e){}})()`

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-da"] })
  return () => obs.disconnect()
}

const read = (): DaVersion => (document.documentElement.dataset.da === "noir" ? "noir" : "bleu")

export function useDaVersion(): [DaVersion, (v: DaVersion) => void] {
  const version = useSyncExternalStore(subscribe, read, () => "bleu" as DaVersion)

  function change(v: DaVersion) {
    document.documentElement.dataset.da = v
    try {
      localStorage.setItem(KEY, v)
    } catch {}
  }

  return [version, change]
}
