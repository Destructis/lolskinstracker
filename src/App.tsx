import { useState } from "react";
import LolSkinsTracker from "./LolSkinsTracker";
import ConnectedAccountPage from "./ConnectedAccountPage";

type Page = "skins" | "account";

export default function App() {
	const [page, setPage] = useState<Page>("skins");

	return (
		<div>
			<nav className="top-nav">
				<button
					type="button"
					className={page === "skins" ? "top-nav__button is-active" : "top-nav__button"}
					onClick={() => setPage("skins")}
				>
					Suivi des skins
				</button>
				<button
					type="button"
					className={page === "account" ? "top-nav__button is-active" : "top-nav__button"}
					onClick={() => setPage("account")}
				>
					Compte connecté
				</button>
			</nav>

			{page === "skins" ? <LolSkinsTracker /> : <ConnectedAccountPage />}
		</div>
	);
}
