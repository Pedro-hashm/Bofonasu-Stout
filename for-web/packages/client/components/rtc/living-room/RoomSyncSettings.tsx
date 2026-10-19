import { useState } from "@revolt/state";
import { Link2 } from "lucide-solid";
import { Show } from "solid-js";

export function RoomSyncSettings() {
  const room = useState().livingRoom;
  const count = () =>
    Object.values(room.syncState.peers).filter(
      (p) => p.viewing && p.synchronized,
    ).length;
  const status = () => {
    const sync = room.syncState;
    if (sync.error) return sync.error;
    if (!room.enabled)
      return "Ative o modo sala para participar da sincronização.";
    if (!sync.channel) return "Entre em uma chamada para sincronizar.";
    if (sync.status === "connecting") return "Conectando à sala compartilhada…";
    if (!sync.active)
      return "Ative o Living Room nesta chamada para sincronizar.";
    return count() > 1
      ? `${count()} pessoas no modo sincronizado`
      : "Sincronizado · aguardando seus amigos";
  };
  return (
    <section class="lr-sync-settings" aria-label="Sincronização do Living Room">
      <label class="lr-check">
        <input
          type="checkbox"
          checked={room.synchronized}
          onChange={(e) => {
            room.synchronized = e.currentTarget.checked;
          }}
        />
        Modo sincronizado
      </label>
      <p>
        Compartilhe as posições dos participantes nesta chamada. Você pode mover
        seus amigos e eles podem mover você. Use Editar sala para arrastar.
      </p>
      <p>
        Fundo, tela, chat e presets continuam locais. Ao desativar, suas
        posições locais são restauradas.
      </p>
      <Show when={room.synchronized}>
        <div
          class="lr-sync-status"
          role={room.syncState.error ? "alert" : "status"}
          data-error={!!room.syncState.error}
        >
          <Link2 size={14} />
          <span>{status()}</span>
        </div>
      </Show>
    </section>
  );
}
