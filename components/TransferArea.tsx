import React, { useRef, useState } from 'react';
import { FileType, TransferFile, SmartMetaData, ConnectedDevice } from '../types';

interface TransferAreaProps {
  files: TransferFile[];
  onFileUpload: (files: FileList) => void;
  activeDevice: ConnectedDevice | null;
}

export const TransferArea: React.FC<TransferAreaProps> = ({ files, onFileUpload, activeDevice }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    if (file.analysisStatus === 'analyzing') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Gemini Thinking...
        </span>
      );
    }
    if (file.analysisStatus === 'completed' && file.metaData) {
        return (
            <div className="flex flex-wrap gap-2 mt-2">
                {file.metaData.tags?.map((tag, idx) => (
                    <span key={idx} className="text-[10px] uppercase tracking-wider font-bold text-primary-300 bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                        {tag}
                    </span>
                ))}
            </div>
        )
    }
    return null;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 relative">
      {/* Header */}
      <div className="h-16 border-b border-slate-700 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-medium text-white">
            {activeDevice ? `Connected to ${activeDevice.name}` : 'Select a device'}
          </h2>
          <p className="text-xs text-slate-500">
            {activeDevice ? 'Ready to send/receive files' : 'Choose a device from the sidebar to start'}
          </p>
        </div>
        <div className="flex gap-2">
           {/* Mock actions */}
            <button className="p-2 text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <button className="p-2 text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        {files.length === 0 && (
            <div 
                className={`h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${
                    isDragging ? 'border-primary-500 bg-primary-500/5 scale-[0.99]' : 'border-slate-700 hover:border-slate-600'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-black/20">
                    <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                </div>
                <h3 className="text-xl font-medium text-white mb-2">Drop files to send</h3>
                <p className="text-slate-500 mb-8 max-w-sm text-center">
                    Files dropped here will be analyzed by Gemini AI for smart tagging and summaries.
                </p>
                <button 
                    onClick={triggerFileInput}
                    className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-primary-600/20"
                >
                    Browse Files
                </button>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {files.map((file) => (
                <div key={file.id} className="group bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-all hover:shadow-xl hover:shadow-black/20 animate-fade-in-up">
                    <div className="aspect-video bg-slate-900 relative overflow-hidden group-hover:opacity-90 transition-opacity">
                        {file.type === FileType.IMAGE ? (
                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                        )}
                        
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white font-mono">
                            {file.type}
                        </div>
                    </div>

                    <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-white truncate pr-2" title={file.name}>{file.name}</h4>
                            <span className="text-xs text-slate-500 shrink-0">{formatSize(file.size)}</span>
                        </div>

                        {renderAnalysisStatus(file)}

                        {file.metaData?.summary && (
                            <p className="mt-3 text-xs text-slate-400 leading-relaxed border-t border-slate-700/50 pt-3">
                                <span className="text-primary-400 font-semibold mr-1">✨ Gemini:</span>
                                {file.metaData.summary}
                            </p>
                        )}
                        
                         <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
                             <span>From: {file.fromDevice}</span>
                             <span>{new Date(file.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                         </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => e.target.files && onFileUpload(e.target.files)} 
        className="hidden" 
        multiple
      />

        {/* Floating Action Button for when list is populated */}
        {files.length > 0 && (
            <button 
                onClick={triggerFileInput}
                className="absolute bottom-8 right-8 w-14 h-14 bg-primary-600 hover:bg-primary-500 text-white rounded-full shadow-lg shadow-primary-600/30 flex items-center justify-center transition-transform hover:scale-105"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
        )}
    </div>
  );
};
