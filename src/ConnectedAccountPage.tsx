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
  const [status, setStatus] = useState("Clique sur le bouton pour tester le client local.");
  const [activePlayer, setActivePlayer] = useState<ActivePlayer | null>(null);
  const [players, setPlayers] = useState<LocalPlayer[]>([]);

  const checkLocalClient = async () => {
    setLoading(true);
    setStatus("Connexion au client local...");

    try {
      const gameResponse = await fetch("/riot-local/liveclientdata/gamestats");

      if (gameResponse.status === 404) {
        setActivePlayer(null);
        setPlayers([]);
        setStatus("Aucune partie en cours. Ouvre une game puis réessaie.");
        return;
      }

      if (!gameResponse.ok) {
        throw new Error(`gamestats: ${gameResponse.status}`);
      }

      const [activeResponse, playersResponse] = await Promise.all([
        fetch("/riot-local/liveclientdata/activeplayer"),
        fetch("/riot-local/liveclientdata/playerlist"),
      ]);

      if (activeResponse.status === 404 || playersResponse.status === 404) {
        setActivePlayer(null);
        setPlayers([]);
        setStatus("Le client est ouvert, mais aucune partie exploitable n'est détectée.");
        return;
      }

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
      setStatus("Données du client local chargées.");
    } catch (caughtError) {
      setActivePlayer(null);
      setPlayers([]);
      const message = caughtError instanceof Error ? caughtError.message : "";
      setStatus(
        message.includes("Failed to fetch")
          ? "Le client League n'est pas accessible. Lance le client, puis réessaie."
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
            <p className="subtitle" style={{ marginTop: 8 }}>
              {status}
            </p>
          </div>

          <div className="toolbar">
            <button type="button" className="action-button" onClick={checkLocalClient} disabled={loading}>
              {loading ? "Connexion…" : "Lire le client local"}
            </button>
          </div>
        </header>

        <div className="notice">{status}</div>

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
            Pour lire un compte hors partie, il faut passer par le client League local
            avec ses endpoints internes, ou par un backend Riot autorisé avec login RSO.
            L’API Live Client seule ne peut pas donner ces données hors game.
          </p>
        </section>
      </div>
    </div>
  );
}