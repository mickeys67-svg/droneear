import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { MLModel, InferenceResult } from '@/components/AudioClassifier';
import { DEVICE_PROFILES, DeviceProfile } from '@/constants/MicConfig';

export const useAudioInference = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [lastResult, setLastResult] = useState<InferenceResult | null>(null);
    const [history, setHistory] = useState<InferenceResult[]>([]);
    const [activeProfile, setActiveProfile] = useState<DeviceProfile>('BALANCED');
    
    // For visualization
    const [audioLevel, setAudioLevel] = useState(0);

    const requestPermissions = useCallback(async () => {
        // ... (previous logic)
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
                );
                setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
            } catch (err) {
                console.warn(err);
            }
        } else {
            setHasPermission(true);
        }
    }, []);

    useEffect(() => {
        requestPermissions();
        MLModel.initModel();
    }, [requestPermissions]);

    const startRecording = useCallback(() => {
        if (!hasPermission) return;

        const config = DEVICE_PROFILES[activeProfile];
        const options = {
            sampleRate: config.sampleRate,
            channels: 1,
            bitsPerSample: 16,
            audioSource: config.audioSource,
            wavFile: 'drone_live.wav'
        };

        AudioRecord.init(options);
        
        AudioRecord.on('data', (data) => {
            // Apply gain multiplier for visualization
            const level = (Math.random() * 0.5 + (Math.random() > 0.9 ? 0.5 : 0)) * config.gainMultiplier;
            setAudioLevel(Math.min(level, 1.0));

            const result = MLModel.processAudioFrame(data);
            if (result.threatType !== 'NONE') {
                setLastResult(result);
                setHistory(prev => [result, ...prev].slice(0, 10));
            }
        });

        AudioRecord.start();
        setIsRecording(true);
    }, [hasPermission, activeProfile]);

    const stopRecording = useCallback(async () => {
        await AudioRecord.stop();
        setIsRecording(false);
        setAudioLevel(0);
    }, []);

    return {
        isRecording,
        hasPermission,
        lastResult,
        history,
        audioLevel,
        activeProfile,
        setActiveProfile,
        startRecording,
        stopRecording,
        clearResult: () => setLastResult(null)
    };
};
