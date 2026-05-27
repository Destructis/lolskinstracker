import { useState } from "react";

type ActivePlayer = {
  riotId?: string;
  riotIdGameName?: string;
  riotIdTagLine?: string;
  summonerName?: string;
  championStats?: Record<string, unknown>;
  level?: number;
  currentGold?: number;
  fullRunes?: Record<string, unknown>;
};

type LocalPlayer = {
  riotId?: string;
  riotIdGameName?: string;
  riotIdTagLine?: string;
  summonerName?: string;
  championName?: string;
  rawChampionName?: string;
  skinID?: number;
  team?: string;
  level?: number;
};

export default function ConnectedAccountPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activePlayer, setActivePlayer] = useState<ActivePlayer | null>(null);
  const [players, setPlayers] = useState<LocalPlayer[]>([]);

  const checkLocalClient = async () => {
    setLoading(true);
    setError("");

    try {
      const [activeResponse, playersResponse] = await Promise.all([
        fetch("/riot-local/liveclientdata/activeplayer"),
        fetch("/riot-local/liveclientdata/playerlist"),
      ]);

      if (!activeResponse.ok) {
        throw new Error(`activeplayer: ${activeResponse.status}`);
      }

      if (!playersResponse.ok) {
        throw new Error(`playerlist: ${playersResponse.status}`);
      }

      const active = (await activeResponse.json()) as ActivePlayer;
      const list = (await playersResponse.json()) as LocalPlayer[];

      setActivePlayer(active);
      setPlayers(list);
    } catch (caughtError) {
      setActivePlayer(null);
      setPlayers([]);
      const message = caughtError instanceof Error ? caughtError.message : "";
      setError(
        message.includes("Failed to fetch")
          ? "Le client League n'est pas accessible. Lance une partie et garde le client ouvert, puis réessaie."
          : message || "Impossible de joindre le client local Riot.",
      );
    } finally {
      setLoading(false);
    }
  };

  const localPlayer = activePlayer?.riotId
    ? players.find((player) => player.riotId === activePlayer.riotId)
    : players[0];

  return (
    <div className="tracker-shell">
      <div className="tracker-card account-card">
        <header className="tracker-header">
          <div>
            <p className="eyebrow">Compte connecté</p>
            <h1>Infos du client local</h1>
            <p className="subtitle">
              Cette page lit le client League en local si une partie est en cours.
              L’API publique Riot ne fournit pas l’inventaire de skins possédés.
            </p>
          </div>

          <div className="toolbar">
            <button type="button" className="action-button" onClick={checkLocalClient} disabled={loading}>
              {loading ? "Connexion…" : "Lire le client local"}
            </button>
          </div>
        </header>

        {error ? <div className="notice notice--error">{error}</div> : null}

        <section className="account-grid">
          <article className="info-card">
            <h2>Ce que la page peut lire</h2>
            <p>
              Riot expose le joueur actif, le Riot ID, le champion joué, le skinID,
              le niveau, les runes et quelques stats pendant une partie.
            </p>
          </article>

          <article className="info-card">
            <h2>Ce qu’elle ne peut pas lire</h2>
            <p>
              La liste complète des skins possédés par un compte n’est pas exposée par
              l’API publique standard. Pour ça, il faudrait un flux local dédié ou un
              backend autorisé par Riot.
            </p>
          </article>
        </section>

        <section className="account-details">
          <div className="detail-row">
            <span className="detail-label">Riot ID</span>
            <span className="detail-value">{activePlayer?.riotId ?? "Aucune donnée"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Compte</span>
            <span className="detail-value">
              {activePlayer?.riotIdGameName && activePlayer?.riotIdTagLine
                ? `${activePlayer.riotIdGameName}#${activePlayer.riotIdTagLine}`
                : activePlayer?.summonerName ?? "Aucune donnée"}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Niveau</span>
            <span className="detail-value">{activePlayer?.level ?? "Aucune donnée"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Gold</span>
            <span className="detail-value">
              {typeof activePlayer?.currentGold === "number"
                ? Math.round(activePlayer.currentGold)
                : "Aucune donnée"}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Champion</span>
            <span className="detail-value">
              {localPlayer?.championName ?? localPlayer?.rawChampionName ?? "Aucune donnée"}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Skin ID en jeu</span>
            <span className="detail-value">
              {typeof localPlayer?.skinID === "number" ? localPlayer.skinID : "Aucune donnée"}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Équipe</span>
            <span className="detail-value">{localPlayer?.team ?? "Aucune donnée"}</span>
          </div>
        </section>

        <section className="account-footer">
          <p>
            Si tu veux vraiment afficher les skins possédés du compte connecté, il faudra
            brancher un backend Riot autorisé ou un flux local du client, parce que le web
            seul ne peut pas lire cet inventaire.
          </p>
        </section>
      </div>
    </div>
  );
}