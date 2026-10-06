"use client";
import { useToast } from "./ui";

export default function InviteCard({ family }: { family: { name: string; invite_code: string } }) {
  const toast = useToast();
  return (
    <div className="card">
      <h2>Ajak keluarga</h2>
      <p className="small">Bagikan kode ini supaya anggota keluarga lain bisa ikut mencatat dan melihat data {family.name}.</p>
      <div className="invite">
        <code>{family.invite_code}</code>
        <button className="btn sm" style={{ width: "auto" }} onClick={() => {
          const text = `Gabung "${family.name}" di Boleh Gak, Ya? → ${location.origin} (kode: ${family.invite_code})`;
          (navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text)).then(() => toast.success("Undangan siap dibagikan."), () => {});
        }}>Bagikan</button>
      </div>
    </div>
  );
}
