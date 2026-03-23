"use client";
import { useEffect, useState } from 'react';

const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).require) {
    return (window as any).require('electron').ipcRenderer;
  }
  return null;
};
const ipcRenderer = getIpcRenderer();

export default function Home() {
  const [status, setStatus] = useState("Initializing...");
  const [qr, setQr] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [message, setMessage] = useState("Hello {{name}}! 🚀\n\nWelcome to our premium service.");
  const [selectedFile, setSelectedFile] = useState("");
  const [previewBase64, setPreviewBase64] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.on('whatsapp-qr', (_: any, code: string) => { setQr(code); setStatus("Scan QR"); });
      ipcRenderer.on('whatsapp-status', (_: any, s: string) => { setStatus(s); if(s === "Ready") setQr(""); });
      ipcRenderer.on('campaign-progress', (_: any, p: any) => setProgress(p));
    }
  }, []);

  const handleUpload = async () => {
    const res = await ipcRenderer?.invoke('upload-contacts');
    if (res?.success) setContacts(res.contacts);
  };

  const handleSelectFile = async () => {
    const path = await ipcRenderer?.invoke('select-file');
    if (path) {
      setSelectedFile(path);
      const previewRes = await ipcRenderer?.invoke('get-preview-data', path);
      if (previewRes.success) setPreviewBase64(previewRes.base64);
    }
  };

  const startCampaign = async () => {
    if (contacts.length === 0) return alert("Upload contacts first!");
    setIsSending(true);
    await ipcRenderer?.invoke('start-campaign', { contacts, message, filePath: selectedFile });
    setIsSending(false);
    setProgress({ current: 0, total: 0 });
    alert("Campaign Finished!");
  };

  if (status !== "Ready" && status !== "Authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
        <div className="bg-white p-12 rounded-[2rem] shadow-2xl text-center max-w-sm w-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">WhatsApp Login</h2>
          {qr ? (
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
              <img src={qr} alt="QR" className="mx-auto" />
            </div>
          ) : (
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-200 rounded-full mb-4"></div>
              <p className="text-slate-400 font-medium tracking-wide uppercase text-xs">Loading Engine...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F1F5F9] text-slate-900 font-sans overflow-hidden">
      
      {/* LEFT: SETTINGS PANEL */}
      <div className="w-[450px] bg-white border-r border-slate-200 flex flex-col shadow-xl">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0">
          <h1 className="text-xl font-black tracking-tighter text-slate-900">BULK SENDER <span className="text-blue-600">PRO</span></h1>
          <div className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-black uppercase">Online</div>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto">
          {/* STEP 1 */}
          <section>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">01. Import Audience</label>
            <button 
              onClick={handleUpload}
              className={`w-full py-4 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-3
                ${contacts.length > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-400'}`}
            >
              <span className="font-bold text-sm">{contacts.length > 0 ? `✅ ${contacts.length} Contacts Ready` : "Select Excel/CSV"}</span>
            </button>
          </section>

          {/* STEP 2 */}
          <section>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">02. Message Content</label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl h-40 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm leading-relaxed"
              placeholder="Type here..."
            />
            <button onClick={handleSelectFile} className="mt-3 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
              📎 {selectedFile ? "Change Attachment" : "Attach Image/File"}
            </button>
          </section>

          {/* ACTION */}
          <section className="pt-4">
            {isSending ? (
              <div className="bg-slate-900 p-6 rounded-2xl text-white">
                <div className="flex justify-between text-[10px] font-bold mb-2 uppercase tracking-widest opacity-60">
                  <span>Progress</span>
                  <span>{progress.current}/{progress.total}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${(progress.current/progress.total)*100}%` }}></div>
                </div>
                <p className="mt-4 text-[9px] italic opacity-50 text-center uppercase tracking-widest">Applying 30s security delay...</p>
              </div>
            ) : (
              <button 
                onClick={startCampaign}
                disabled={contacts.length === 0}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 shadow-lg shadow-blue-200 transition-all"
              >
                Launch Campaign 🚀
              </button>
            )}
          </section>
        </div>
      </div>

      {/* RIGHT: SMART PREVIEW */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-100/50">
        <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mb-10">Real-Time Preview</div>
        
        {/* PHONE FRAME */}
        <div className="w-[340px] h-[680px] bg-slate-900 rounded-[3rem] p-3 shadow-2xl border border-slate-300 flex flex-col">
          <div className="flex-1 bg-white rounded-[2.5rem] overflow-hidden flex flex-col relative">
            
            {/* WHATSAPP HEADER */}
            <div className="bg-[#075e54] pt-10 pb-4 px-5 text-white flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex-shrink-0"></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate">{contacts[0]?.name || "Customer Name"}</p>
                <p className="text-[9px] opacity-60">online</p>
              </div>
            </div>

            {/* CHAT AREA */}
            <div className="flex-1 bg-[#E5DDD5] p-3 flex flex-col overflow-y-auto" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}>
              <div className="self-end max-w-[90%] bg-[#DCF8C6] p-2 rounded-xl rounded-tr-none shadow-sm border border-black/5">
                {previewBase64 && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-black/5">
                    <img src={previewBase64} alt="Preview" className="w-full object-cover max-h-[250px]" />
                  </div>
                )}
                <p className="text-[12px] text-slate-800 whitespace-pre-wrap leading-[1.4]">
                  {message.replace(/{{name}}/g, contacts[0]?.name || "Customer")}
                </p>
                <div className="flex justify-end gap-1 mt-1 opacity-30">
                  <span className="text-[8px] font-bold">12:00 PM</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34B7F1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 22 8"></polyline><polyline points="2 13 7 18 13 12"></polyline></svg>
                </div>
              </div>
            </div>

            {/* INPUT MOCKUP */}
            <div className="p-3 bg-[#F0F0F0] flex items-center gap-2">
              <div className="flex-1 bg-white h-8 rounded-full"></div>
              <div className="w-8 h-8 bg-[#075e54] rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}