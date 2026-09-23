import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

type SchoolSettings = {
    id: number;
    schoolName: string;
    schoolAddress: string | null;
    phone: string | null;
    email: string | null;
    principalName: string | null;
    academicYear: string | null;
    setupCompleted: boolean;
    createdAt: string;
    updatedAt: string;
};

export function SettingsPage({
    onSetupComplete,
}: {
    onSetupComplete?: () => void;
}) {
    const [settings, setSettings] = useState<SchoolSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const [schoolName, setSchoolName] = useState('');
    const [schoolAddress, setSchoolAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [principalName, setPrincipalName] = useState('');
    const [academicYear, setAcademicYear] = useState('');

    useEffect(() => {
        void loadSettings();
    }, []);

    async function loadSettings() {
        setLoading(true);
        setMessage('');

        const result = await api.get<SchoolSettings>('/settings');

        if (!result.success || !result.data) {
            setMessage(result.error ?? 'Unable to load school settings.');
            setLoading(false);
            return;
        }

        const data = result.data;

        setSettings(data);
        setSchoolName(data.schoolName);
        setSchoolAddress(data.schoolAddress ?? '');
        setPhone(data.phone ?? '');
        setEmail(data.email ?? '');
        setPrincipalName(data.principalName ?? '');
        setAcademicYear(data.academicYear ?? '');

        setLoading(false);
    }

    async function handleSave(event: React.FormEvent) {
        event.preventDefault();

        if (!schoolName.trim()) {
            setMessage('School name is required.');
            return;
        }

        setSaving(true);
        setMessage('');

        const result = await api.patch<SchoolSettings>('/settings', {
            schoolName,
            schoolAddress,
            phone,
            email,
            principalName,
            academicYear,
            setupCompleted: true,
        });

        if (!result.success || !result.data) {
            setMessage(result.error ?? 'Unable to save school settings.');
            setSaving(false);
            return;
        }

        setSettings(result.data);
        setMessage('School setup saved successfully.');
        setSaving(false);

        console.log('SETUP COMPLETE CALLBACK FIRED');
        onSetupComplete?.();
    }

    if (loading) {
        return (
            <div style={{ padding: '2rem' }}>
                <p>Loading school settings...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '900px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ marginBottom: '0.5rem' }}>
                    {settings?.setupCompleted
                        ? 'School Settings'
                        : 'School Setup'}
                </h1>

                <p style={{ color: '#777', margin: 0 }}>
                    Configure the basic information for this school installation.
                </p>
            </div>

            <form
                onSubmit={handleSave}
                style={{
                    display: 'grid',
                    gap: '1rem',
                }}
            >
                <label>
                    <div style={{ marginBottom: '0.35rem' }}>
                        School Name *
                    </div>

                    <input
                        value={schoolName}
                        onChange={(event) => setSchoolName(event.target.value)}
                        placeholder="Enter school name"
                        required
                        style={{
                            width: '100%',
                            padding: '0.7rem',
                            boxSizing: 'border-box',
                        }}
                    />
                </label>

                <label>
                    <div style={{ marginBottom: '0.35rem' }}>
                        School Address
                    </div>

                    <input
                        value={schoolAddress}
                        onChange={(event) => setSchoolAddress(event.target.value)}
                        placeholder="Enter school address"
                        style={{
                            width: '100%',
                            padding: '0.7rem',
                            boxSizing: 'border-box',
                        }}
                    />
                </label>

                <label>
                    <div style={{ marginBottom: '0.35rem' }}>
                        Phone
                    </div>

                    <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="Enter school phone"
                        style={{
                            width: '100%',
                            padding: '0.7rem',
                            boxSizing: 'border-box',
                        }}
                    />
                </label>

                <label>
                    <div style={{ marginBottom: '0.35rem' }}>
                        Email
                    </div>

                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Enter school email"
                        style={{
                            width: '100%',
                            padding: '0.7rem',
                            boxSizing: 'border-box',
                        }}
                    />
                </label>

                <label>
                    <div style={{ marginBottom: '0.35rem' }}>
                        Principal Name
                    </div>

                    <input
                        value={principalName}
                        onChange={(event) => setPrincipalName(event.target.value)}
                        placeholder="Enter principal name"
                        style={{
                            width: '100%',
                            padding: '0.7rem',
                            boxSizing: 'border-box',
                        }}
                    />
                </label>

                <label>
                    <div style={{ marginBottom: '0.35rem' }}>
                        Academic Year
                    </div>

                    <input
                        value={academicYear}
                        onChange={(event) => setAcademicYear(event.target.value)}
                        placeholder="e.g. 2026-27"
                        style={{
                            width: '100%',
                            padding: '0.7rem',
                            boxSizing: 'border-box',
                        }}
                    />
                </label>

                {message && (
                    <div
                        style={{
                            padding: '0.75rem',
                            background: '#f3f4f6',
                            borderRadius: '6px',
                        }}
                    >
                        {message}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={saving}
                    style={{
                        width: 'fit-content',
                        padding: '0.75rem 1.25rem',
                        cursor: saving ? 'default' : 'pointer',
                    }}
                >
                    {saving ? 'Saving...' : 'Save School Settings'}
                </button>
            </form>
        </div>
    );
}