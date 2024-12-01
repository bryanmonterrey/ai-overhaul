import { useState, useEffect } from 'react';
import { getAdminSettings, updateAdminSetting } from '@/supabase/schema/auth-settings';

export function AdminSettings() {
  const [settings, setSettings] = useState({
    token_gate_enabled: false,
    required_token_value: 0
  });

  useEffect(() => {
    async function loadSettings() {
      const adminSettings = await getAdminSettings();
      if (adminSettings) {
        setSettings({
          token_gate_enabled: adminSettings.token_gate_enabled,
          required_token_value: adminSettings.required_token_value
        });
      }
    }
    loadSettings();
  }, []);

  const handleToggleGating = async () => {
    await updateAdminSetting('admin', 'token_gate_enabled', (!settings.token_gate_enabled).toString());
    setSettings(prev => ({
      ...prev,
      token_gate_enabled: !prev.token_gate_enabled
    }));
  };

  const handleValueChange = async (value: number) => {
    await updateAdminSetting('admin', 'required_token_value', value.toString());
    setSettings(prev => ({
      ...prev,
      required_token_value: value
    }));
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Token Gating Settings</h2>
      
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.token_gate_enabled}
            onChange={handleToggleGating}
            className="mr-2"
          />
          Enable Token Gating
        </label>
      </div>

      <div className="mb-4">
        <label className="block mb-2">
          Required Token Value (USD)
          <input
            type="number"
            value={settings.required_token_value}
            onChange={(e) => handleValueChange(Number(e.target.value))}
            className="block w-full mt-1 p-2 border rounded"
            min="0"
          />
        </label>
      </div>
    </div>
  );
}