import { useState, useEffect } from 'react';
import { ArrowLeft, FolderOpen, Printer, Save, Key, Camera } from 'lucide-react';
import { Button } from '../components/Button';

interface SettingsProps {
    onBack: () => void;
}

export const Settings = ({ onBack }: SettingsProps) => {
    const [outputFolder, setOutputFolder] = useState('');
    const [printers, setPrinters] = useState<any[]>([]);
    const [selectedPrinter, setSelectedPrinter] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [selectedCamera, setSelectedCamera] = useState('');
    const [testMode, setTestMode] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        if (window.fotoQuAPI) {
            const settings = await window.fotoQuAPI.getSettings();
            setOutputFolder(settings.outputFolder || '');
            setSelectedPrinter(settings.printerName || '');
            setAccessToken(settings.accessToken || '');
            setSelectedCamera(settings.cameraDeviceId || '');
            setTestMode(settings.testMode || false);

            const printerList = await window.fotoQuAPI.getPrinters();
            setPrinters(printerList);

            // Load Cameras
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                setCameras(videoDevices);

                // If no camera selected but cameras exist, select the first one
                if (!settings.cameraDeviceId && videoDevices.length > 0) {
                    setSelectedCamera(videoDevices[0].deviceId);
                }
            } catch (err) {
                console.error("Error loading cameras:", err);
            }
        }
    };

    const handleSelectFolder = async () => {
        if (window.fotoQuAPI) {
            const path = await window.fotoQuAPI.selectOutputFolder();
            if (path) {
                setOutputFolder(path);
            }
        }
    };

    const handleSave = async () => {
        if (window.fotoQuAPI) {
            await window.fotoQuAPI.saveSettings({
                outputFolder,
                printerName: selectedPrinter,
                accessToken,
                cameraDeviceId: selectedCamera,
                testMode
            });
            setStatus('Pengaturan disimpan!');
            setTimeout(() => setStatus(''), 2000);
        }
    };

    return (
        <div className="flex-1 flex flex-col p-8 bg-slate-50">
            <div className="max-w-2xl mx-auto w-full space-y-8">
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-white border-slate-200 hover:bg-slate-50 text-slate-700">
                        <ArrowLeft className="w-5 h-5" />
                        <span>Kembali</span>
                    </Button>
                    <h1 className="text-3xl font-bold text-slate-900">Pengaturan</h1>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm space-y-6 border border-slate-100">
                    {/* Access Token */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Access Token (Photobox ID)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={accessToken}
                                    onChange={(e) => setAccessToken(e.target.value)}
                                    placeholder="Masukkan token akses dari Admin Panel"
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">Token ini digunakan untuk menghubungkan aplikasi dengan server.</p>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Output Folder */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Folder Penyimpanan Foto</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={outputFolder}
                                    readOnly
                                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 outline-none"
                                />
                            </div>
                            <Button variant="secondary" onClick={handleSelectFolder}>
                                Pilih Folder
                            </Button>
                        </div>
                    </div>

                    {/* Printer Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Printer Default</label>
                        <div className="relative">
                            <Printer className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <select
                                value={selectedPrinter}
                                onChange={(e) => setSelectedPrinter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none appearance-none bg-white transition-all"
                            >
                                <option value="">-- Pilih Printer --</option>
                                {printers.map((p) => (
                                    <option key={p.name} value={p.name}>
                                        {p.name} {p.isDefault ? '(Default)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Camera Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Kamera</label>
                        <div className="relative">
                            <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <select
                                value={selectedCamera}
                                onChange={(e) => setSelectedCamera(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none appearance-none bg-white transition-all"
                            >
                                <option value="">-- Pilih Kamera --</option>
                                {cameras.map((c) => (
                                    <option key={c.deviceId} value={c.deviceId}>
                                        {c.label || `Camera ${c.deviceId.slice(0, 5)}...`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <p className="text-xs text-slate-500">Pilih kamera yang akan digunakan untuk sesi foto.</p>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Test Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <h3 className="text-sm font-medium text-slate-900">Mode Testing</h3>
                            <p className="text-xs text-slate-500 mt-1">Jalankan sesi tanpa mengunggah foto ke server.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={testMode}
                                onChange={(e) => setTestMode(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                        <span className="text-green-600 font-medium text-sm">{status}</span>
                        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30">
                            <Save className="w-5 h-5 mr-2" />
                            Simpan Pengaturan
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
