import { useEffect, useMemo, useRef, useState } from "react";

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

const STORAGE_KEY = "lol-skins-tracker:champions";

const CHAMPION_NAMES = [
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

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/["'`\.\-\s]/g, "");

const championId = (name: string): string => `champ_${normalize(name)}`;

function createDefaultChampions(): Champion[] {
  return CHAMPION_NAMES.map((name) => ({
    id: championId(name),
    name,
    skins: [],
  }));
}

function sanitizeChampions(input: unknown): Champion[] {
  if (!Array.isArray(input)) {
    return createDefaultChampions();
  }

  const byName = new Map<string, Champion>();

  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const candidate = item as Partial<Champion>;
    if (typeof candidate.name !== "string") continue;

    const skins = Array.isArray(candidate.skins)
      ? candidate.skins
          .filter((skin) => skin && typeof skin === "object")
          .map((skin) => {
            const typedSkin = skin as Partial<Skin>;
            return {
              id:
                typeof typedSkin.id === "string" && typedSkin.id.trim()
                  ? typedSkin.id
                  : uid(),
              name: typeof typedSkin.name === "string" ? typedSkin.name : "",
              checked: Boolean(typedSkin.checked),
            };
          })
          .filter((skin) => skin.name.trim().length > 0)
      : [];

    byName.set(candidate.name, {
      id:
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id
          : championId(candidate.name),
      name: candidate.name,
      skins,
    });
  }

  const merged = CHAMPION_NAMES.map((name) => {
    const existing = byName.get(name);
    return existing ?? { id: championId(name), name, skins: [] };
  });

  for (const champion of byName.values()) {
    if (
      !CHAMPION_NAMES.includes(champion.name as (typeof CHAMPION_NAMES)[number])
    ) {
      merged.push(champion);
    }
  }

  return merged;
}

function loadChampions(): Champion[] {
  if (typeof window === "undefined") {
    return createDefaultChampions();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultChampions();
    }

    return sanitizeChampions(JSON.parse(raw));
  } catch {
    return createDefaultChampions();
  }
}

function saveChampions(champions: Champion[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(champions));
}

function exportChampions(champions: Champion[]): void {
  const blob = new Blob([JSON.stringify(champions, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "lol-skins-tracker.json";
  link.click();

  URL.revokeObjectURL(url);
}

function mergeImportedChampions(
  current: Champion[],
  imported: Champion[],
): Champion[] {
  const importedByName = new Map(
    imported.map((champion) => [champion.name, champion] as const),
  );

  return current.map((champion) => {
    const incoming = importedByName.get(champion.name);
    if (!incoming) {
      return champion;
    }

    return {
      id: champion.id,
      name: champion.name,
      skins: Array.isArray(incoming.skins)
        ? incoming.skins
            .filter(
              (skin) =>
                skin &&
                typeof skin.name === "string" &&
                skin.name.trim().length > 0,
            )
            .map((skin) => ({
              id:
                typeof skin.id === "string" && skin.id.trim() ? skin.id : uid(),
              name: skin.name,
              checked: Boolean(skin.checked),
            }))
        : champion.skins,
    };
  });
}

export default function LolSkinsTracker() {
  const [champions, setChampions] = useState<Champion[]>(loadChampions);
  const [query, setQuery] = useState("");
  const [showMode, setShowMode] = useState<"all" | "with" | "without">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    saveChampions(champions);
  }, [champions]);

  const normalizedQuery = useMemo(() => normalize(query), [query]);

  const hasCheckedSkin = (champion: Champion): boolean =>
    champion.skins.some((skin) => skin.checked);

  const filteredChampions = useMemo(
    () =>
      champions.filter((champion) => {
        if (
          normalizedQuery &&
          !normalize(champion.name).includes(normalizedQuery)
        ) {
          return false;
        }

        if (showMode === "with" && !hasCheckedSkin(champion)) {
          return false;
        }

        if (showMode === "without" && hasCheckedSkin(champion)) {
          return false;
        }

        return true;
      }),
    [champions, normalizedQuery, showMode],
  );

  const totals = useMemo(() => {
    const championsWithCheckedSkin = champions.filter(hasCheckedSkin).length;
    const totalSkins = champions.reduce(
      (sum, champion) => sum + champion.skins.length,
      0,
    );
    const checkedSkins = champions.reduce(
      (sum, champion) =>
        sum + champion.skins.filter((skin) => skin.checked).length,
      0,
    );

    return {
      championsWithCheckedSkin,
      totalChampions: champions.length,
      checkedSkins,
      totalSkins,
    };
  }, [champions]);

  const updateChampion = (
    id: string,
    updater: (champion: Champion) => Champion,
  ) => {
    setChampions((previous) =>
      previous.map((champion) =>
        champion.id === id ? updater(champion) : champion,
      ),
    );
  };

  const toggleAllSkins = (championId: string, checked: boolean) => {
    updateChampion(championId, (champion) => ({
      ...champion,
      skins: champion.skins.map((skin) => ({ ...skin, checked })),
    }));
  };

  const toggleSkin = (championId: string, skinId: string, checked: boolean) => {
    updateChampion(championId, (champion) => ({
      ...champion,
      skins: champion.skins.map((skin) =>
        skin.id === skinId ? { ...skin, checked } : skin,
      ),
    }));
  };

  const addSkin = (championId: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    updateChampion(championId, (champion) => ({
      ...champion,
      skins: [
        ...champion.skins,
        { id: uid(), name: trimmedName, checked: false },
      ],
    }));
  };

  const removeSkin = (championId: string, skinId: string) => {
    updateChampion(championId, (champion) => ({
      ...champion,
      skins: champion.skins.filter((skin) => skin.id !== skinId),
    }));
  };

  const clearAllChecks = () => {
    setChampions((previous) =>
      previous.map((champion) => ({
        ...champion,
        skins: champion.skins.map((skin) => ({ ...skin, checked: false })),
      })),
    );
  };

  const expandAll = () =>
    setExpanded(new Set(filteredChampions.map((champion) => champion.id)));
  const collapseAll = () => setExpanded(new Set());

  const handleExport = () => {
    exportChampions(champions);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("le fichier doit contenir un tableau de champions");
    }

    const importedChampions = sanitizeChampions(parsed);
    setChampions((previous) =>
      mergeImportedChampions(previous, importedChampions),
    );
  };

  return (
    <div className="tracker-shell">
      <div className="tracker-card">
        <header className="tracker-header">
          <div>
            <p className="eyebrow">Suivi local</p>
            <h1>League of Legends - Suivi des skins</h1>
            <p className="subtitle">
              {totals.championsWithCheckedSkin}/{totals.totalChampions}{" "}
              champions avec au moins un skin coché - {totals.checkedSkins}/
              {totals.totalSkins} skins cochés
            </p>
          </div>

          <div className="toolbar">
            <button
              type="button"
              onClick={clearAllChecks}
              className="action-button"
            >
              Réinitialiser les coches
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="action-button"
            >
              Exporter JSON
            </button>

            <label className="action-button file-button">
              Importer JSON
              <input
                type="file"
                accept="application/json"
                onChange={async (event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";

                  if (!file) {
                    return;
                  }

                  try {
                    await handleImport(file);
                  } catch (error) {
                    window.alert(
                      `Échec de l'import: ${error instanceof Error ? error.message : "inconnu"}`,
                    );
                  }
                }}
              />
            </label>
          </div>
        </header>

        <section className="filters">
          <input
            type="text"
            placeholder="Filtrer par nom..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filtrer par nom"
            className="text-input"
          />

          <select
            value={showMode}
            onChange={(event) =>
              setShowMode(event.target.value as typeof showMode)
            }
            aria-label="Filtrer par statut"
            className="select-input"
          >
            <option value="all">Afficher: Tous</option>
            <option value="with">Afficher: Avec skin coche</option>
            <option value="without">Afficher: Sans skin coche</option>
          </select>

          <div className="toolbar compact">
            <button type="button" onClick={expandAll} className="action-button">
              Tout déployer
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="action-button"
            >
              Tout replier
            </button>
          </div>
        </section>

        <ul className="champion-list">
          {filteredChampions.map((champion) => (
            <ChampionRow
              key={champion.id}
              champion={champion}
              expanded={expanded.has(champion.id)}
              setExpanded={(open) =>
                setExpanded((previous) => {
                  const next = new Set(previous);
                  if (open) {
                    next.add(champion.id);
                  } else {
                    next.delete(champion.id);
                  }
                  return next;
                })
              }
              onToggleAll={(checked) => toggleAllSkins(champion.id, checked)}
              onToggleSkin={(skinId, checked) =>
                toggleSkin(champion.id, skinId, checked)
              }
              onAddSkin={(skinName) => addSkin(champion.id, skinName)}
              onRemoveSkin={(skinId) => removeSkin(champion.id, skinId)}
            />
          ))}
        </ul>

        {filteredChampions.length === 0 ? (
          <p className="empty-state">
            Aucun champion ne correspond à votre filtre.
          </p>
        ) : null}
      </div>
    </div>
  );
}

type ChampionRowProps = {
  champion: Champion;
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSkin: (skinId: string, checked: boolean) => void;
  onAddSkin: (name: string) => void;
  onRemoveSkin: (skinId: string) => void;
};

function ChampionRow({
  champion,
  expanded,
  setExpanded,
  onToggleAll,
  onToggleSkin,
  onAddSkin,
  onRemoveSkin,
}: ChampionRowProps) {
  const [newSkin, setNewSkin] = useState("");
  const masterRef = useRef<HTMLInputElement>(null);

  const totalSkins = champion.skins.length;
  const checkedSkins = champion.skins.filter((skin) => skin.checked).length;
  const allChecked = totalSkins > 0 && checkedSkins === totalSkins;
  const someChecked = checkedSkins > 0 && checkedSkins < totalSkins;

  useEffect(() => {
    if (masterRef.current) {
      masterRef.current.indeterminate = someChecked && !allChecked;
    }
  }, [someChecked, allChecked]);

  const submitSkin = () => {
    onAddSkin(newSkin);
    setNewSkin("");
  };

  return (
    <li className="champion-row">
      <div className="champion-row__top">
        <input
          ref={masterRef}
          type="checkbox"
          checked={allChecked}
          onChange={(event) => onToggleAll(event.target.checked)}
          disabled={totalSkins === 0}
          aria-label={`Tout cocher pour ${champion.name}`}
        />

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="champion-row__toggle"
          aria-expanded={expanded}
          aria-controls={`panel-${champion.id}`}
        >
          <span>{champion.name}</span>
          <span className="champion-row__count">
            {checkedSkins}/{totalSkins}
          </span>
        </button>
      </div>

      {expanded ? (
        <div id={`panel-${champion.id}`} className="champion-row__panel">
          <div className="add-skin-row">
            <input
              type="text"
              placeholder="Ajouter un skin..."
              value={newSkin}
              onChange={(event) => setNewSkin(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitSkin();
                }
              }}
              aria-label={`Ajouter un skin pour ${champion.name}`}
              className="text-input"
            />
            <button
              type="button"
              onClick={submitSkin}
              className="action-button"
            >
              Ajouter
            </button>
          </div>

          {champion.skins.length === 0 ? (
            <p className="empty-inline">
              Aucun skin pour l'instant. Ajoutez-en ci-dessus.
            </p>
          ) : (
            <ul className="skin-list">
              {champion.skins.map((skin) => (
                <li key={skin.id} className="skin-item">
                  <label className="skin-item__label">
                    <input
                      type="checkbox"
                      checked={skin.checked}
                      onChange={(event) =>
                        onToggleSkin(skin.id, event.target.checked)
                      }
                    />
                    <span>{skin.name}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => onRemoveSkin(skin.id)}
                    className="delete-button"
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}
