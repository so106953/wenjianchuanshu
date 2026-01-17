import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ConnectedDevice, DeviceType } from '../types';

interface SidebarProps {
  devices: ConnectedDevice[];
  activeDeviceId: string | null;
  onSelectDevice: (id: string) => void;
  shareUrl: string;
}

const getDeviceIcon = (type: DeviceType) => {
  switch (type) {
    case DeviceType.ANDROID: return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    );
    case DeviceType.IOS: return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    );
    case DeviceType.WINDOWS: return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    );
    default: return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    );
  }
};

export const Sidebar: React.FC<SidebarProps> = ({ devices, activeDeviceId, onSelectDevice, shareUrl }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  // Extract ID from shareUrl for display
  const displayId = new URLSearchParams(shareUrl.split('?')[1]).get('hostId') || 'Connecting...';

  useEffect(() => {
    if (!shareUrl) return;
    
    QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M'
    })
    .then(setQrCodeDataUrl)
    .catch((err: any) => console.error('QR Generation failed', err));
  }, [shareUrl]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  return (
    <div className="w-full md:w-72 bg-slate-850 border-r border-slate-700 flex flex-col h-full shadow-xl z-20">
      <div className="p-6 border-b border-slate-700 bg-slate-850">
        <div className="flex items-center gap-2 text-primary-400 font-bold text-xl">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>NeuroSync</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Cross-Platform • AI Enhanced</p>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        
        {/* Connection Card */}
        <div className="mb-6 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-sm flex flex-col items-center text-center">
            <p className="text-xs font-semibold text-slate-300 mb-3 w-full text-left flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.131A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.2-2.858.59-4.18" /></svg>
                Connect Device
            </p>
            <div className="w-40 h-40 bg-white p-2 rounded-lg mb-3 shadow-inner overflow-hidden relative group cursor-pointer transition-transform hover:scale-105" title="Scan with WeChat or Camera">
                {qrCodeDataUrl ? (
                   <img src={qrCodeDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                ) : (
                   <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                   </div>
                )}
            </div>
            <p className="text-[11px] text-slate-400 mb-3 leading-tight">
                Scan with <strong>Camera</strong> or <strong>WeChat</strong><br/>to join this session.
            </p>
            
            <button 
              onClick={copyLink}
              className={`w-full py-2 text-xs font-bold rounded transition-all flex items-center justify-center gap-2 ${
                  copyStatus === 'copied' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50' 
                  : 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/20'
              }`}
            >
              {copyStatus === 'copied' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Link Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  Copy Session Link
                </>
              )}
            </button>
        </div>

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Session Devices</h3>
        
        {devices.length === 0 ? (
            <div className="text-center py-6 px-4 border border-dashed border-slate-700 rounded-lg">
                <div className="animate-pulse-slow inline-block p-2 bg-slate-800 rounded-full mb-2">
                    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </div>
                <p className="text-xs text-slate-500">Waiting for connections...</p>
            </div>
        ) : (
            <div className="space-y-2">
            {devices.map((device) => (
                <button
                key={device.id}
                onClick={() => onSelectDevice(device.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 border ${
                    activeDeviceId === device.id
                    ? 'bg-primary-600/20 text-primary-400 border-primary-600/30'
                    : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border-transparent hover:border-slate-700'
                }`}
                >
                <div className={`p-2 rounded-full shrink-0 ${
                    activeDeviceId === device.id ? 'bg-primary-600/20' : 'bg-slate-800'
                }`}>
                    {getDeviceIcon(device.type)}
                </div>
                <div className="text-left flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{device.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                        device.status === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 
                        device.status === 'transferring' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'
                    }`} />
                    <span className="text-[10px] text-slate-500 capitalize">{device.status}</span>
                    </div>
                </div>
                </button>
            ))}
            </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-850">
         <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-500 to-purple-600 shadow-lg flex items-center justify-center text-xs font-bold text-white border border-white/10">
                ME
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">My Device</p>
                <p className="text-[10px] text-slate-500 truncate" title={displayId}>
                    ID: {displayId}
                </p>
            </div>
         </div>
      </div>
    </div>
  );
};