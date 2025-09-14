// file: src/LolSkinsTracker.tsx
import { useEffect, useMemo, useRef, useState, type JSX } from "react";

/**
 * React TS component for tracking LoL skins per champion.
 * - LocalStorage persistence
 * - Search by name (accent/punctuation-insensitive)
 * - Filter champions: all / with checked skin / without checked skin
 * - Expand/collapse champions, add/remove skins
 * - Champion-level checkbox = (check/uncheck all skins), indeterminate when partial
 * - "Préremplir" depuis Riot Data Dragon (dernière version), paresseux par champion + bouton global
 *
 * WHY comments only: normalization & persistence & DDragon mapping are critical for UX stability.
 */

// ----------------------------- Types -----------------------------

type Skin = {
  id: string;
  name: string;
  checked: boolean;
};

type Champion = {
  id: string;
  name: string;
  skins: Skin[];
};

// Data Dragon (minimal types)
type DDragonChampionIndex = {
  type: string;
  format: string;
  version: string;
  data: Record<string, { id: string; key: string; name: string; title: string }>;
};

type DDragonChampionDetail = {
  type: string;
  format: string;
  version: string;
  data: Record<
    string,
    {
      id: string;
      name: string;
      skins: { id: string; num: number; name: string; chromas: boolean }[];
    }
  >;
};

// ----------------------------- Constants -----------------------------

const STORAGE_KEY = "lol-skins-tracker:v2"; // bump schema for DDragon mapping
const DDRAGON_LOCALE = "fr_FR"; // can be made configurable if needed

const CHAMPION_NAMES: readonly string[] = [
  "Aatrox",
  "Ahri",
  "Akali",
  "Akshan",
  "Alistar",
  "Ambessa",
  "Amumu",
  "Anivia",
  "Annie",
  "Aphelios",
  "Ashe",
  "Aurelion Sol",
  "Aurora",
  "Azir",
  "Bard",
  "Bel'Veth",
  "Blitzcrank",
  "Brand",
  "Braum",
  "Briar",
  "Caitlyn",
  "Camille",
  "Cassiopeia",
  "Cho'Gath",
  "Corki",
  "Darius",
  "Diana",
  "Dr. Mundo",
  "Draven",
  "Ekko",
  "Elise",
  "Evelynn",
  "Ezreal",
  "Fiddlesticks",
  "Fiora",
  "Fizz",
  "Galio",
  "Gangplank",
  "Garen",
  "Gnar",
  "Gragas",
  "Graves",
  "Gwen",
  "Hecarim",
  "Heimerdinger",
  "Hwei",
  "Illaoi",
  "Irelia",
  "Ivern",
  "Janna",
  "Jarvan IV",
  "Jax",
  "Jayce",
  "Jhin",
  "Jinx",
  "Kai'Sa",
  "Kalista",
  "Karma",
  "Karthus",
  "Kassadin",
  "Katarina",
  "Kayle",
  "Kayn",
  "Kennen",
  "Kha'Zix",
  "Kindred",
  "Kled",
  "Kog'Maw",
  "K'Sante",
  "LeBlanc",
  "Lee Sin",
  "Leona",
  "Lillia",
  "Lissandra",
  "Lucian",
  "Lulu",
  "Lux",
  "Malphite",
  "Malzahar",
  "Maokai",
  "Master Yi",
  "Mel",
  "Milio",
  "Miss Fortune",
  "Mordekaiser",
  "Morgana",
  "Naafiri",
  "Nami",
  "Nasus",
  "Nautilus",
  "Neeko",
  "Nidalee",
  "Nilah",
  "Nocturne",
  "Nunu",
  "Olaf",
  "Orianna",
  "Ornn",
  "Pantheon",
  "Poppy",
  "Pyke",
  "Qiyana",
  "Quinn",
  "Rakan",
  "Rammus",
  "Rek'Sai",
  "Rell",
  "Renata Glasc",
  "Renekton",
  "Rengar",
  "Riven",
  "Rumble",
  "Ryze",
  "Samira",
  "Sejuani",
  "Senna",
  "Seraphine",
  "Sett",
  "Shaco",
  "Shen",
  "Shyvana",
  "Singed",
  "Sion",
  "Sivir",
  "Skarner",
  "Smolder",
  "Sona",
  "Soraka",
  "Swain",
  "Sylas",
  "Syndra",
  "Tahm Kench",
  "Taliyah",
  "Talon",
  "Taric",
  "Teemo",
  "Thresh",
  "Tristana",
  "Trundle",
  "Tryndamere",
  "Twisted Fate",
  "Twitch",
  "Udyr",
  "Urgot",
  "Varus",
  "Vayne",
  "Veigar",
  "Vel'Koz",
  "Vex",
  "Vi",
  "Viego",
  "Viktor",
  "Vladimir",
  "Volibear",
  "Warwick",
  "Wukong",
  "Xayah",
  "Xerath",
  "Xin Zhao",
  "Yasuo",
  "Yone",
  "Yorick",
  "Yunara",
  "Yuumi",
  "Zac",
  "Zed",
  "Zeri",
  "Ziggs",
  "Zilean",
  "Zoe",
  "Zyra",
] as const;

// ----------------------------- Utils -----------------------------

const uid = (): string => {
  // Stable ids help persistence; fallback avoids crypto requirement in older browsers.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
};

/** Accent/punctuation-insensitive search normalization. */
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['`.\-\s]/g, "");

const nameToId = (name: string) => `champ_${normalize(name)}`;

// ----------------------------- Persistence -----------------------------

function loadInitialChampions(): Champion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: Champion[] | null = raw ? JSON.parse(raw) : null;

    // Index by canonical name for merging.
    const byName = new Map<string, Champion>();
    if (parsed) {
      for (const c of parsed) byName.set(c.name, c);
    }

    const merged: Champion[] = CHAMPION_NAMES.map((name) => {
      const existing = byName.get(name);
      if (existing) {
        // Ensure shape (handles schema changes/new fields).
        return {
          id: existing.id || nameToId(name),
          name: existing.name,
          skins: Array.isArray(existing.skins)
            ? existing.skins.map((s) => ({ id: s.id || uid(), name: s.name, checked: !!s.checked }))
            : [],
        } satisfies Champion;
      }
      return { id: nameToId(name), name, skins: [] } satisfies Champion;
    });

    // Keep any custom champions previously added (if any).
    if (parsed) {
      for (const c of parsed) {
        if (!CHAMPION_NAMES.includes(c.name)) merged.push(c);
      }
    }

    return merged;
  } catch {
    // Corrupt storage → start fresh.
    return CHAMPION_NAMES.map((name) => ({ id: nameToId(name), name, skins: [] }));
  }
}

function saveChampions(champions: Champion[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(champions));
}

// ----------------------------- Data Dragon helpers -----------------------------

/**
 * WHY: We hit Data Dragon (static CDN, no API key) to get official skins.
 * Docs & endpoints reference:
 *  - Versions list: https://ddragon.leagueoflegends.com/api/versions.json
 *  - Champion index: /cdn/{ver}/data/{locale}/champion.json
 *  - Per champion:   /cdn/{ver}/data/{locale}/champion/{Key}.json
 * See Riot docs "Data Dragon" for details.
 */

async function fetchDdragonLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const list = (await res.json()) as string[];
    return Array.isArray(list) && list.length > 0 ? list[0] : null; // newest first per spec
  } catch {
    return null;
  }
}

async function fetchChampionIndex(version: string, locale: string): Promise<DDragonChampionIndex | null> {
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion.json`);
    if (!res.ok) return null;
    return (await res.json()) as DDragonChampionIndex;
  } catch {
    return null;
  }
}

/** Build normalized-name -> DDragon Key map (e.g., "cho'gath" -> "Chogath"). */
function buildKeyMap(idx: DDragonChampionIndex): Map<string, string> {
  const m = new Map<string, string>();
  for (const [key, val] of Object.entries(idx.data)) {
    m.set(normalize(val.name), key); // localized display name
    m.set(normalize(val.id), key); // safety: internal ID form (JarvanIV, KSante, etc.)
  }
  return m;
}

async function fetchChampionSkins(version: string, locale: string, key: string): Promise<string[]> {
  try {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/champion/${key}.json`);
    if (!res.ok) return [];
    const data = (await res.json()) as DDragonChampionDetail;
    const champ = data.data[key];
    if (!champ) return [];
    // Exclude base (num === 0). In FR locale, base name can be "Classique"; in en it's "default".
    return champ.skins.filter((s) => s.num > 0).map((s) => s.name.trim());
  } catch {
    return [];
  }
}

// ----------------------------- Main Component -----------------------------

export default function LolSkinsTracker(): JSX.Element {
  const [champions, setChampions] = useState<Champion[]>(() => loadInitialChampions());
  const [query, setQuery] = useState("");
  const [showMode, setShowMode] = useState<"all" | "with" | "without">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // DDragon state
  const [ddVersion, setDdVersion] = useState<string | null>(null);
  const [ddKeyMap, setDdKeyMap] = useState<Map<string, string> | null>(null);
  const [prefilling, setPrefilling] = useState(false);

  useEffect(() => {
    saveChampions(champions);
  }, [champions]);

  // Bootstrap DDragon mapping once.
  useEffect(() => {
    (async () => {
      const v = await fetchDdragonLatestVersion();
      if (!v) return;
      setDdVersion(v);
      const idx = await fetchChampionIndex(v, DDRAGON_LOCALE);
      if (idx) setDdKeyMap(buildKeyMap(idx));
    })();
  }, []);

  const normQuery = useMemo(() => normalize(query), [query]);

  const hasChecked = (c: Champion) => c.skins.some((s) => s.checked);

  const filtered = useMemo(() => {
    return champions.filter((c) => {
      if (normQuery && !normalize(c.name).includes(normQuery)) return false;
      if (showMode === "with" && !hasChecked(c)) return false;
      if (showMode === "without" && hasChecked(c)) return false;
      return true;
    });
  }, [champions, normQuery, showMode]);

  const totals = useMemo(() => {
    const champsWithChecked = champions.filter(hasChecked).length;
    const skinChecked = champions.reduce((acc, c) => acc + c.skins.filter((s) => s.checked).length, 0);
    const skinTotal = champions.reduce((acc, c) => acc + c.skins.length, 0);
    return { champsWithChecked, champsTotal: champions.length, skinChecked, skinTotal };
  }, [champions]);

  // ----------------------------- Mutations -----------------------------

  const updateChampion = (id: string, updater: (c: Champion) => Champion) => {
    setChampions((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  const toggleAllSkins = (championId: string, checked: boolean) => {
    updateChampion(championId, (c) => ({
      ...c,
      skins: c.skins.map((s) => ({ ...s, checked })),
    }));
  };

  const toggleSkin = (championId: string, skinId: string, checked: boolean) => {
    updateChampion(championId, (c) => ({
      ...c,
      skins: c.skins.map((s) => (s.id === skinId ? { ...s, checked } : s)),
    }));
  };

  const addSkin = (championId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateChampion(championId, (c) => ({
      ...c,
      skins: [...c.skins, { id: uid(), name: trimmed, checked: false }],
    }));
  };

  const removeSkin = (championId: string, skinId: string) => {
    updateChampion(championId, (c) => ({
      ...c,
      skins: c.skins.filter((s) => s.id !== skinId),
    }));
  };

  const clearAllChecks = () => {
    setChampions((prev) => prev.map((c) => ({ ...c, skins: c.skins.map((s) => ({ ...s, checked: false })) })));
  };

  const expandAll = () => setExpanded(new Set(filtered.map((c) => c.id)));
  const collapseAll = () => setExpanded(new Set());

  // ----------------------------- Import / Export -----------------------------

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(champions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lol-skins-tracker.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Champion[];
      if (!Array.isArray(data)) throw new Error("Fichier invalide");
      const byName = new Map(data.map((c) => [c.name, c] as const));
      setChampions((prev) =>
        prev.map((c) => {
          const incoming = byName.get(c.name);
          if (!incoming) return c;
          return {
            id: c.id,
            name: c.name,
            skins: Array.isArray(incoming.skins)
              ? incoming.skins.map((s) => ({ id: s.id || uid(), name: s.name, checked: !!s.checked }))
              : c.skins,
          } satisfies Champion;
        })
      );
    } catch (e) {
      alert("Échec de l\'import: " + (e instanceof Error ? e.message : "inconnu"));
    }
  };

  // ----------------------------- DDragon Prefill -----------------------------

  /** Merge fetched skin names with existing champion skins (keep checked states). */
  const mergeSkins = (c: Champion, fetchedNames: string[]): Champion => {
    const existingByName = new Map(c.skins.map((s) => [normalize(s.name), s] as const));
    const merged: Skin[] = [];
    for (const name of fetchedNames) {
      const key = normalize(name);
      const existing = existingByName.get(key);
      if (existing) merged.push(existing);
      else merged.push({ id: uid(), name, checked: false });
    }
    // Keep any custom skins that were not in fetched list
    for (const s of c.skins) {
      if (!existingByName.has(normalize(s.name)) && !fetchedNames.some((n) => normalize(n) === normalize(s.name))) {
        merged.push(s);
      }
    }
    return { ...c, skins: merged };
  };

  const prefillChampion = async (c: Champion): Promise<void> => {
    if (!ddVersion || !ddKeyMap) return;
    const key = ddKeyMap.get(normalize(c.name));
    if (!key) return; // Not in DDragon (e.g., Ambessa/Mel/Yunara at the time of writing)
    const names = await fetchChampionSkins(ddVersion, DDRAGON_LOCALE, key);
    if (names.length === 0) return;
    updateChampion(c.id, (curr) => mergeSkins(curr, names));
  };

  const prefillVisible = async () => {
    if (!ddVersion || !ddKeyMap) return;
    setPrefilling(true);
    try {
      // Simple sequential loop to be gentle on CDN.
      for (const c of filtered) {
        await prefillChampion(c);
      }
    } finally {
      setPrefilling(false);
    }
  };

  // ----------------------------- Render -----------------------------

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">League of Legends — Suivi des skins</h1>
            <p className="mt-1 text-sm text-gray-600">
              {totals.champsWithChecked}/{totals.champsTotal} champions avec au moins un skin coché · {totals.skinChecked}/
              {totals.skinTotal} skins cochés
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Données des skins via Data Dragon {ddVersion ? `(v${ddVersion})` : "(chargement…)"}. Ce projet n'est pas affilié à Riot Games.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={clearAllChecks} className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-100">
              Réinitialiser les coches
            </button>
            <button onClick={exportJson} className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-100">
              Exporter JSON
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-100">
              Importer JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJson(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              disabled={!ddVersion || !ddKeyMap || prefilling}
              onClick={prefillVisible}
              className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              title="Préremplir les skins officiels pour les champions affichés"
            >
              {prefilling ? "Préremplissage…" : "Préremplir (visibles)"}
            </button>
          </div>
        </header>

        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_max-content_max-content]">
          <input
            type="text"
            placeholder="Filtrer par nom…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border bg-white px-4 py-2 shadow-sm outline-none focus:ring-2 focus:ring-gray-300"
            aria-label="Filtrer par nom"
          />
          <select
            value={showMode}
            onChange={(e) => setShowMode(e.target.value as typeof showMode)}
            className="rounded-2xl border bg-white px-3 py-2 text-sm shadow-sm"
            aria-label="Filtrer par statut"
            title="Filtrer par statut"
          >
            <option value="all">Afficher: Tous</option>
            <option value="with">Afficher: Avec skin coché</option>
            <option value="without">Afficher: Sans skin coché</option>
          </select>
          <div className="flex gap-2">
            <button onClick={expandAll} className="rounded-2xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-100">Tout déployer</button>
            <button onClick={collapseAll} className="rounded-2xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-100">Tout replier</button>
          </div>
        </div>

        <ul className="space-y-2">
          {filtered.map((c) => (
            <ChampionRow
              key={c.id}
              champion={c}
              expanded={expanded.has(c.id)}
              setExpanded={(open) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (open) next.add(c.id);
                  else next.delete(c.id);
                  return next;
                })
              }
              onToggleAll={(checked) => toggleAllSkins(c.id, checked)}
              onToggleSkin={(skinId, checked) => toggleSkin(c.id, skinId, checked)}
              onAddSkin={(name) => addSkin(c.id, name)}
              onRemoveSkin={(skinId) => removeSkin(c.id, skinId)}
              onPrefill={() => prefillChampion(c)}
              ddragonReady={!!ddVersion && !!ddKeyMap}
            />
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="mt-8 text-center text-sm text-gray-500">Aucun champion ne correspond à votre filtre.</p>
        )}
      </div>
    </div>
  );
}

// ----------------------------- Subcomponents -----------------------------

type ChampionRowProps = {
  champion: Champion;
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSkin: (skinId: string, checked: boolean) => void;
  onAddSkin: (name: string) => void;
  onRemoveSkin: (skinId: string) => void;
  onPrefill: () => void;
  ddragonReady: boolean;
};

function ChampionRow({ champion, expanded, setExpanded, onToggleAll, onToggleSkin, onAddSkin, onRemoveSkin, onPrefill, ddragonReady }: ChampionRowProps) {
  const total = champion.skins.length;
  const checkedCount = champion.skins.filter((s) => s.checked).length;
  const allChecked = total > 0 && checkedCount === total;
  const someChecked = checkedCount > 0 && checkedCount < total;

  const masterRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  const [newSkin, setNewSkin] = useState("");

  return (
    <li className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <input
          ref={masterRef}
          type="checkbox"
          className="size-5 rounded border-gray-300"
          checked={allChecked}
          onChange={(e) => onToggleAll(e.target.checked)}
          disabled={total === 0}
          aria-label={`Tout cocher pour ${champion.name}`}
          title={total === 0 ? "Ajoutez des skins pour activer" : "Cocher/Décocher tous les skins"}
        />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center justify-between rounded-xl px-2 py-1 text-left hover:bg-gray-50"
          aria-expanded={expanded}
          aria-controls={`panel-${champion.id}`}
        >
          <span className="font-medium">{champion.name}</span>
          <span className="inline-flex items-center gap-2 text-xs text-gray-600">
            <span className="rounded-full border px-2 py-0.5">{checkedCount}/{total}</span>
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : "rotate-0"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </button>
        <button
          onClick={onPrefill}
          disabled={!ddragonReady}
          className="ml-auto rounded-lg border px-2 py-1 text-xs shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          title="Préremplir les skins officiels pour ce champion"
        >
          ↻ Préremplir
        </button>
      </div>

      {expanded && (
        <div id={`panel-${champion.id}`} className="border-t p-3">
          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ajouter un skin…"
              value={newSkin}
              onChange={(e) => setNewSkin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onAddSkin(newSkin);
                  setNewSkin("");
                }
              }}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-gray-300"
              aria-label={`Ajouter un skin pour ${champion.name}`}
            />
            <button
              onClick={() => {
                onAddSkin(newSkin);
                setNewSkin("");
              }}
              className="rounded-xl border px-3 py-2 text-sm shadow-sm hover:bg-gray-100"
            >
              Ajouter
            </button>
          </div>

          {champion.skins.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun skin pour l'instant. Ajoutez-en ci-dessus ou utilisez "Préremplir".</p>
          ) : (
            <ul className="space-y-2">
              {champion.skins.map((skin) => (
                <li key={skin.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-gray-300"
                      checked={skin.checked}
                      onChange={(e) => onToggleSkin(skin.id, e.target.checked)}
                    />
                    <span className="text-sm">{skin.name}</span>
                  </label>
                  <button
                    onClick={() => onRemoveSkin(skin.id)}
                    className="rounded-lg border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    title="Supprimer ce skin"
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
