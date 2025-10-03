"use client"

import { VIAForm } from '@/vComponents/VIAForm'
import { SystemSettingsProvider } from '@/components/petri/system-settings-context'

export default function TestVIAFormPage() {
  return (
    <SystemSettingsProvider>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">VIAForm Test Page</h1>
        <div className="border rounded-md p-4">
          <VIAForm
            showActionButtons={true}
            initialColor=""
          />
        </div>
      </div>
    </SystemSettingsProvider>
  )
}