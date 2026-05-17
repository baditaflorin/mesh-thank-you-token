import { useEffect, useState } from "react";
import {
  QRExchange,
  makeScanPayload,
  type MeshConfig,
  type YRoom,
  MeshNameInput,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Token = { from: string; to: string; ts: number; reason: string };

const NAME_KEY = (p: string) => `${p}:displayName`;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="viral-screen">
        <h1>thank-you tokens</h1>
        <p className="viral-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [reason, setReason] = useState("");
  const [, rerender] = useState(0);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    const t = room.doc.getArray<Token>("tokens");
    const n = room.doc.getMap<string>("names");
    const cb = () => rerender((r) => r + 1);
    t.observe(cb);
    n.observe(cb);
    return () => {
      t.unobserve(cb);
      n.unobserve(cb);
    };
  }, [room]);

  const tokens = room.doc.getArray<Token>("tokens");
  const names = room.doc.getMap<string>("names");

  useEffect(() => {
    if (name.trim()) names.set(room.peerId, name.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, room.peerId]);

  const tokenList = tokens.toArray();
  const today = new Date().toISOString().slice(0, 10);
  const myToday = tokenList.filter(
    (t) => t.from === room.peerId && new Date(t.ts).toISOString().slice(0, 10) === today,
  );
  const DAILY_LIMIT = 3;
  const remaining = Math.max(0, DAILY_LIMIT - myToday.length);

  const give = (toPeerId: string, toName?: string) => {
    if (!name.trim() || toPeerId === room.peerId || remaining === 0) return;
    if (toName) names.set(toPeerId, toName);
    tokens.push([{ from: room.peerId, to: toPeerId, ts: Date.now(), reason: reason.trim() }]);
    setReason("");
  };

  // leaderboard: received - given (positive = net thanked)
  const score = new Map<string, { given: number; received: number; name: string }>();
  names.forEach((n, id) => score.set(id, { given: 0, received: 0, name: n }));
  for (const t of tokenList) {
    const f = score.get(t.from) ?? {
      given: 0,
      received: 0,
      name: names.get(t.from) ?? t.from.slice(0, 6),
    };
    f.given++;
    score.set(t.from, f);
    const to = score.get(t.to) ?? {
      given: 0,
      received: 0,
      name: names.get(t.to) ?? t.to.slice(0, 6),
    };
    to.received++;
    score.set(t.to, to);
  }
  const leaderboard = Array.from(score.entries())
    .map(([id, s]) => ({ id, ...s, net: s.received - s.given }))
    .filter((s) => s.received + s.given > 0)
    .sort((a, b) => b.net - a.net || b.received - a.received);

  const myPayload = makeScanPayload(room.roomId, room.peerId, name.trim() || "anon");

  return (
    <div className="viral-screen">
      <header>
        <h1>thank-you tokens</h1>
        <p className="viral-status">
          {tokenList.length} tokens given today · {remaining}/{DAILY_LIMIT} left for you today
        </p>
      </header>

      <MeshNameInput
        className="viral-name"
        value={name}
        onChange={setName}
        placeholder="your name"
        maxLength={48}
      />

      <input
        className="viral-name"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="what for? (e.g. great pairing session)"
        maxLength={120}
      />

      <QRExchange
        myPayload={myPayload}
        showLabel="your QR"
        scanLabel={remaining === 0 ? "out of tokens for today" : "scan to send a thank-you"}
        onScan={(parsed) => give(parsed.peerId, parsed.extra ?? undefined)}
      />

      <section>
        <h2 className="viral-section-title">gratitude leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="viral-empty">no tokens yet</p>
        ) : (
          <ol className="tt-list">
            {leaderboard.map((l, i) => (
              <li key={l.id} className={l.id === room.peerId ? "is-me" : ""}>
                <span className="tt-rank">#{i + 1}</span>
                <strong>{l.name}</strong>
                <span className="tt-score">
                  net{" "}
                  <strong>
                    {l.net >= 0 ? "+" : ""}
                    {l.net}
                  </strong>{" "}
                  · received {l.received} · given {l.given}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="viral-section-title">recent thank-yous</h2>
        {tokenList.length === 0 ? (
          <p className="viral-empty">none yet</p>
        ) : (
          <ul className="tt-feed">
            {tokenList
              .slice()
              .reverse()
              .slice(0, 12)
              .map((t, i) => (
                <li key={i}>
                  <strong>{names.get(t.from) ?? t.from.slice(0, 6)}</strong> 🙏{" "}
                  <strong>{names.get(t.to) ?? t.to.slice(0, 6)}</strong>
                  {t.reason && <em> · {t.reason}</em>}
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
