"use client";

import { useEffect, useState } from "react";

type FixItem = { text?: string } | string;

export default function CorrectionsAdmin() {
  const [list, setList] = useState<FixItem[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'remove' | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('adminToken') : null;
    if (t) setAdminToken(t);
  }, []);

  async function load() {
    const headers: Record<string,string> = {};
    if (adminToken) headers['x-admin-token'] = adminToken;
    const res = await fetch('/api/corrections/list', { headers });
    const data = await res.json();
    setList(data.list || []);
  }

  useEffect(() => { load(); }, []);

  function toggle(i: number) {
    setSelected(s => ({ ...s, [i]: !s[i] }));
  }

  // Promotion moved to server-side; client no longer promotes items.

  async function removeSelected() {
    setConfirmAction('remove');
    setConfirmOpen(true);
  }

  async function doRemove() {
    const indexes = Object.keys(selected).filter(k => selected[Number(k)]).map(Number);
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['x-admin-token'] = adminToken;
    const res = await fetch('/api/corrections/remove', {
      method: 'POST',
      headers,
      body: JSON.stringify({ indexes })
    });
    const data = await res.json();
    if (!res.ok) setNotice(data.error || 'Remove failed');
    else {
      setNotice(`Removed ${data.removed} corrections.`);
      setSelected({});
      load();
    }
    setConfirmOpen(false);
    setConfirmAction(null);
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Corrections Admin</h1>
      <p className="mt-2 text-sm text-zinc-600">Review 'Needs fix' suggestions and remove items you don't want to keep.</p>
      {notice && <div className="mt-4 text-sm text-zinc-700">{notice}</div>}
      <div className="mt-6 space-y-3">
        {list.length === 0 ? (
          <div className="text-sm text-zinc-500">No corrections.</div>
        ) : (
          list.map((it, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
              <input type="checkbox" checked={!!selected[i]} onChange={() => toggle(i)} />
              <div className="flex-1 text-sm text-zinc-800">{typeof it === 'string' ? it : it.text}</div>
            </div>
          ))
        )}
        <div className="mt-4">
          <label className="text-xs text-zinc-500">Admin token (for protected API calls)</label>
          <div className="mt-1 flex gap-2">
            <input className="rounded border px-2 py-1" value={adminToken ?? ''} onChange={(e)=>setAdminToken(e.target.value)} placeholder="paste admin token here" />
            <button className="rounded border px-3" onClick={()=>{ if (adminToken) window.localStorage.setItem('adminToken', adminToken); else window.localStorage.removeItem('adminToken'); setNotice('Saved token locally.'); }}>Save</button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={removeSelected} className="rounded bg-rose-600 px-4 py-2 text-white">Remove selected</button>
        <button onClick={load} className="rounded border px-4 py-2">Refresh</button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded bg-white p-6">
            <p className="mb-4">Are you sure you want to remove the selected corrections?</p>
            <div className="flex gap-2">
              <button onClick={() => doRemove()} className="rounded bg-emerald-600 px-4 py-2 text-white">Yes</button>
              <button onClick={() => { setConfirmOpen(false); setConfirmAction(null); setTagInput(''); }} className="rounded border px-4 py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
