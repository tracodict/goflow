/**
 * Property Tab Configuration Types
 * 
 * These interfaces define the structure for property tab configurations
 * that can be dynamically loaded for each vComponent.
 */

import React from "react"

export interface PropertyFieldConfig {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'script' | 'custom'
  placeholder?: string
  options?: { value: string; label: string }[]
  rows?: number
  helpText?: string
  validation?: (value: string) => string | null
}

export interface PropertySectionConfig {
  title: string
  fields: PropertyFieldConfig[]
  conditional?: (attributes: Record<string, string>) => boolean
}

export interface CustomPropertyRenderProps {
  attributes: Record<string, string>
  onAttributeUpdate: (key: string, value: string) => void
  queries?: any[]
  datasources?: any[]
}

export interface PropertyTabConfig {
  componentType: string
  sections: PropertySectionConfig[]
  customRenderer?: React.FC<CustomPropertyRenderProps>
}

export interface PropertyTabRegistry {
  [componentType: string]: PropertyTabConfig
}