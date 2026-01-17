import React, { useRef, useState, useEffect } from 'react';
import { FileType, TransferFile, ConnectedDevice } from '../types';

interface TransferAreaProps {
  files: TransferFile[];
  onFileUpload: (files: FileList) => void;
  activeDevice: ConnectedDevice | null;
  onSend: () => void;
}

export const TransferArea: React.FC<TransferAreaProps> = ({ files, onFileUpload, activeDevice, onSend }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<TransferFile | null>(null);
  const [textContent, setTextContent] = useState<string>('');

  // Handle preview logic
  useEffect(() => {
    if (previewFile?.type === FileType.TEXT) {
      previewFile.fileObject.text().then(setTextContent).catch(() => setTextContent("Error reading text content."));
    } else {
      setTextContent('');
    }

    if (previewFile) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [previewFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const renderAnalysisStatus = (file: TransferFile) => {
    // Only show analysis for files we own or have received
    if (file.analysisStatus === 'analyzing') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full border border-amber-400/20">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Gemini Analyzing...
        </span>
      );
    }
    if (file.analysisStatus === 'completed' && file.metaData) {
        return (
            <div className="flex flex-wrap gap-2 mt-2">
                {file.metaData.tags?.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="text-[10px] uppercase tracking-wider font-bold text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                        {tag}
                    </span>
                ))}
            </div>
        )
    }
    return null;
  };

  const renderTransferStatus = (file: TransferFile) => {
      // Don't show status for files from others, just "Received" implied by "From: XYZ"
      if (file.fromDevice !== 'Me') {
          return <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded">RECEIVED</span>;
      }
      
      switch (file.transferStatus) {
          case 'queued':
              return <span className="text-[10px] text-slate-400 font-medium bg-slate-700/50 px-2 py-0.5 rounded">QUEUED</span>;
          case 'sending':
              return <span className="text-[10px] text-blue-400 font-bold bg-blue-400/10 px-2 py-0.5 rounded animate-pulse">SENDING...</span>;
          case 'completed':
              return <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded">SENT</span>;
          case 'failed':
              return <span className="text-[10px] text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded">FAILED</span>;
          default:
              return null;
      }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Files ready to send
  const pendingFilesCount = files.filter(f => f.fromDevice === 'Me' && f.transferStatus === 'queued').length;

  // Preview Modal Content (Keep existing code)
  const renderPreviewContent = () => {
      if (!previewFile) return null;
      switch(previewFile.type) {
          case FileType.IMAGE:
              return <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-md" />;
          case FileType.VIDEO:
              return <video controls autoPlay src={previewFile.url} className="max-w-full max-h-[85vh] shadow-2xl rounded-md outline-none bg-black" />;
          case FileType.TEXT:
              return (
                  <div className="bg-slate-800 p-8 rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-slate-700">
                      <pre className="text-sm font-mono text-slate-300 whitespace-pre-wrap break-words">{textContent || "Loading text..."}</pre>
                  </div>
              );
          default:
              return (
                  <div className="bg-slate-800 p-12 rounded-lg text-center border border-slate-700">
                      <svg className="w-20 h-20 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <p className="text-lg text-slate-300">Preview not available for this file type.</p>
                      <p className="text-slate-500 mt-2">{previewFile.name}</p>
                  </div>
              );
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 relative">
      <input type="file" multiple className="hidden" ref={fileInputRef} onChange={(e) => { if(e.target.files) onFileUpload(e.target.files); }} />

      {/* Header */}
      <div className="h-16 border-b border-slate-700 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-medium text-white">
            {activeDevice ? `Connected to ${activeDevice.name}` : 'Select a device'}
          </h2>
          <p className="text-xs text-slate-500">
            {activeDevice ? 'Ready to transfer' : 'Choose a device from the sidebar'}
          </p>
        </div>
        
        {/* Send Button in Header if files are pending */}
        {pendingFilesCount > 0 && activeDevice && (
            <button 
                onClick={onSend}
                className="hidden md:flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-primary-600/20 transition-all active:scale-95"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Send {pendingFilesCount} File{pendingFilesCount > 1 ? 's' : ''}
            </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        {files.length === 0 && (
            <div 
                className={`h-full min-h-[400px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${
                    isDragging ? 'border-primary-500 bg-primary-500/5 scale-[0.99]' : 'border-slate-700 hover:border-slate-600'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-black/20">
                    <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                </div>
                <h3 className="text-xl font-medium text-white mb-2">Drop files to send</h3>
                <p className="text-slate-500 mb-8 max-w-sm text-center">Files dropped here will be analyzed by Gemini AI.</p>
                <button onClick={triggerFileInput} className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-primary-600/20">Browse Files</button>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
            {files.map((file) => (
                <div 
                    key={file.id} 
                    onClick={() => setPreviewFile(file)}
                    className="group bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-primary-500/50 cursor-pointer transition-all hover:shadow-xl hover:shadow-black/20 animate-fade-in-up hover:-translate-y-1"
                >
                    <div className="aspect-video bg-slate-900 relative overflow-hidden group-hover:opacity-90 transition-opacity flex items-center justify-center">
                        {file.type === FileType.IMAGE ? (
                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        ) : file.type === FileType.VIDEO ? (
                            <video src={file.url} className="w-full h-full object-cover" />
                        ) : (
                            <svg className="w-16 h-16 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {file.type === FileType.TEXT ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                )}
                            </svg>
                        )}
                        {file.type === FileType.VIDEO && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-medium text-slate-200 truncate pr-4" title={file.name}>{file.name}</h4>
                            <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">{formatSize(file.size)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-2">
                            {renderTransferStatus(file)}
                        </div>

                        {renderAnalysisStatus(file)}
                        {file.metaData?.summary && <p className="text-xs text-slate-400 mt-2 line-clamp-2 border-l-2 border-primary-500/30 pl-2">{file.metaData.summary}</p>}

                        <div className="mt-4 flex justify-between items-center text-[10px] text-slate-500">
                             <span>From: {file.fromDevice}</span>
                             <span>{new Date(file.timestamp).toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Floating Action Button for Send (Mobile) */}
      {pendingFilesCount > 0 && activeDevice ? (
         <button 
           onClick={onSend}
           className="fixed bottom-8 right-8 h-14 px-6 bg-primary-600 hover:bg-primary-500 text-white rounded-full shadow-2xl shadow-primary-600/40 flex items-center gap-2 justify-center transition-transform hover:scale-105 z-20"
         >
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
           <span className="font-bold">Send ({pendingFilesCount})</span>
         </button>
      ) : (
         /* Upload button only if nothing to send */
         <button 
            onClick={triggerFileInput}
            className="fixed bottom-8 right-8 w-14 h-14 bg-slate-700 hover:bg-slate-600 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-110 md:hidden z-10"
         >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
         </button>
      )}

      {/* Preview Modal (Same as before) */}
      {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewFile(null)}>
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-50" onClick={e => e.stopPropagation()}>
                  <div className="text-white">
                      <h3 className="text-sm font-medium">{previewFile.name}</h3>
                      <p className="text-xs text-slate-400">{formatSize(previewFile.size)} • {previewFile.type}</p>
                  </div>
                  <div className="flex gap-3">
                      <a href={previewFile.url} download={previewFile.name} className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </a>
                      <button onClick={() => setPreviewFile(null)} className="p-2 rounded-full bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
              </div>
              <div className="w-full h-full flex items-center justify-center p-4 md:p-8" onClick={e => e.stopPropagation()}>
                  {renderPreviewContent()}
              </div>
          </div>
      )}
    </div>
  );
};