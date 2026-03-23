"use client";
import { useEffect, useState, useMemo } from 'react';

export default function Home() {
  const [ipc, setIpc] = useState<any>(null);
  const [status, setStatus] = useState("Initializing...");
  const [qr, setQr] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [message, setMessage] = useState("Hello {{name}}! 🚀\n\nWelcome to our premium service.");
  const [selectedFile, setSelectedFile] = useState("");
  const [previewBase64, setPreviewBase64] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const initElectron = async () => {
      if (typeof window !== 'undefined' && (window as any).require) {
        const electron = (window as any).require('electron');
        const renderer = electron.ipcRenderer;
        setIpc(renderer);

        // 1. Immediately poll the backend for current status
        const currentStatus = await renderer.invoke('get-whatsapp-status');
        if (currentStatus) setStatus(currentStatus);

        // 2. Setup event listeners
        renderer.on('whatsapp-qr', (_: any, code: string) => { 
          setQr(code); 
          setStatus("Scan QR"); 
        });
        
        renderer.on('whatsapp-status', (_: any, s: string) => { 
          setStatus(s); 
          if(s.toLowerCase() === "ready" || s.toLowerCase() === "authenticated") setQr(""); 
        });
        
        renderer.on('campaign-progress', (_: any, p: any) => setProgress(p));

        return () => {
          renderer.removeAllListeners('whatsapp-qr');
          renderer.removeAllListeners('whatsapp-status');
          renderer.removeAllListeners('campaign-progress');
        };
      }
    };
    initElectron();
  }, []);

  const handleUpload = async () => {
    if (!ipc) return;
    const res = await ipc.invoke('upload-contacts');
    if (res?.success) setContacts(res.contacts);
  };

  const handleSelectFile = async () => {
    if (!ipc) return;
    const path = await ipc.invoke('select-file');
    if (path) {
      setSelectedFile(path);
      const previewRes = await ipc.invoke('get-preview-data', path);
      if (previewRes.success) setPreviewBase64(previewRes.base64);
    }
  };

  const startCampaign = async () => {
    if (!ipc) return;
    if (contacts.length === 0) return alert("Upload contacts first!");
    setIsSending(true);
    await ipc.invoke('start-campaign', { contacts, message, filePath: selectedFile });
    setIsSending(false);
    setProgress({ current: 0, total: 0 });
    alert("Campaign Finished!");
  };

  // Case-insensitive check to match your terminal's "AUTHENTICATED" or "READY"
  const isDashboardReady = useMemo(() => {
    const s = status.toLowerCase();
    return s === "ready" || s === "authenticated";
  }, [status]);

  if (!isDashboardReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
        <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full border border-slate-100">
          <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tighter uppercase">WhatsApp Engine</h2>
          {status === "Scan QR" && qr ? (
            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 shadow-inner">
              <img src={qr} alt="QR" className="mx-auto w-full h-auto" />
              <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scan to link device</p>
            </div>
          ) : (
            <div className="py-10 flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-6 text-slate-400 font-black tracking-[0.2em] uppercase text-[10px]">{status}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      
      {/* LEFT: SETTINGS PANEL */}
      <div className="w-[450px] bg-white border-r border-slate-200 flex flex-col shadow-xl z-10">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0">
          <h1 className="text-xl font-black tracking-tighter text-slate-900">BULK SENDER <span className="text-blue-600">PRO</span></h1>
          <div className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-black uppercase tracking-tighter">Engine Online</div>
        </div>

        <div className="p-8 space-y-10 overflow-y-auto">
          <section>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">01. Import Audience</label>
            <button 
              onClick={handleUpload}
              className={`w-full py-5 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-3
                ${contacts.length > 0 ? 'bg-green-50 border-green-200 text-green-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-400 hover:bg-blue-50'}`}
            >
              <span className="font-bold text-sm">{contacts.length > 0 ? `✅ ${contacts.length} Contacts Loaded` : "Upload Excel/CSV"}</span>
            </button>
          </section>

          <section>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">02. Message Content</label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl h-44 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm leading-relaxed transition-all"
              placeholder="Use {{name}} for personalization..."
            />
            <button onClick={handleSelectFile} className="mt-4 text-[11px] font-black text-blue-600 flex items-center gap-2 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors w-fit">
              📎 {selectedFile ? "Change Attachment" : "Add Image/PDF Attachment"}
            </button>
          </section>

          <section className="pt-4">
            {isSending ? (
              <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between text-[10px] font-black mb-3 uppercase tracking-[0.2em] opacity-60">
                  <span>Sending Campaign</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-700 ease-out" style={{ width: `${(progress.current/progress.total)*100}%` }}></div>
                </div>
                <p className="mt-5 text-[9px] font-bold text-center uppercase tracking-widest text-blue-400">Processing safety delays...</p>
              </div>
            ) : (
              <button 
                onClick={startCampaign}
                disabled={contacts.length === 0}
                className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-300 shadow-lg shadow-blue-100 transition-all"
              >
                Launch Campaign ⚡
              </button>
            )}
          </section>
        </div>
      </div>

      {/* RIGHT: SMART PREVIEW */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-100/30">
        <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mb-10">WhatsApp Mobile Preview</div>
        
        <div className="w-[360px] h-[720px] bg-slate-900 rounded-[3.5rem] p-3 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-slate-200 flex flex-col relative">
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-20 h-5 bg-slate-900 rounded-full z-20"></div>
          <div className="flex-1 bg-white rounded-[2.8rem] overflow-hidden flex flex-col relative border border-slate-800">
            
            <div className="bg-[#075e54] pt-12 pb-4 px-6 text-white flex items-center gap-4">
              <div className="w-9 h-9 bg-slate-200/20 rounded-full flex-shrink-0 border border-white/10"></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{contacts[0]?.name || "Preview Name"}</p>
                <p className="text-[10px] opacity-60 font-medium">online</p>
              </div>
            </div>

            <div className="flex-1 bg-[#E5DDD5] p-4 flex flex-col overflow-y-auto" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}>
              <div className="self-end max-w-[92%] bg-[#DCF8C6] p-3 rounded-2xl rounded-tr-none shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] border border-black/5">
                {previewBase64 && (
                  <div className="mb-3 rounded-xl overflow-hidden border border-black/5 shadow-sm">
                    <img src={previewBase64} alt="Preview" className="w-full object-cover max-h-[280px]" />
                  </div>
                )}
                <p className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {message.replace(/{{name}}/g, contacts[0]?.name || "Customer")}
                </p>
                <div className="flex justify-end items-center gap-1 mt-1.5 opacity-40">
                  <span className="text-[9px] font-bold">12:00 PM</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34B7F1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 22 8"></polyline><polyline points="2 13 7 18 13 12"></polyline></svg>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#F0F0F0] flex items-center gap-3">
              <div className="flex-1 bg-white h-10 rounded-full shadow-sm"></div>
              <div className="w-10 h-10 bg-[#075e54] rounded-full shadow-md flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}