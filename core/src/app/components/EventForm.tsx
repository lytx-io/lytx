"use client";

// import React from 'react';
import type { PageEvent } from "@/templates/lytxpixel";

export interface EventFieldDefinition {
  name: keyof PageEvent;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
}

interface EventFormProps {
  eventToEdit: PageEvent;
  eventFields: EventFieldDefinition[];
  onEventChange: (fieldName: keyof PageEvent, value: any) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function EventForm({
  eventToEdit,
  eventFields,
  onEventChange,
  onCancel,
  onSubmit,
}: EventFormProps) {

  if (!eventToEdit) {
    return null;
  }

  return (
    <div className="p-6 border rounded-lg bg-[var(--theme-card-bg)] border-[var(--theme-card-border)] shadow-md">
      <h3 className="text-xl font-semibold mb-4 text-[var(--theme-text-primary)]">
        Edit Event: {eventToEdit.event_name || 'New Event'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {eventFields.map(field => (
          <div key={field.name}>
            <label htmlFor={`edit-${field.name}`} className="block text-sm font-medium text-[var(--theme-text-secondary)]">
              {field.label}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={`edit-${field.name}`}
                value={(eventToEdit as any)[field.name] || ''}
                onChange={(e) => onEventChange(field.name, e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-input-border-focus)] focus:border-[var(--theme-input-border-focus)] sm:text-sm text-[var(--theme-text-primary)]"
              />
            ) : field.type === 'select' ? (
              <select
                id={`edit-${field.name}`}
                value={(eventToEdit as any)[field.name] || ''}
                onChange={(e) => onEventChange(field.name, e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-input-border-focus)] focus:border-[var(--theme-input-border-focus)] sm:text-sm text-[var(--theme-text-primary)]"
              >
                {field.options?.map(option => (
                  <option key={option} value={option}>{String(option)}</option>
                ))}
              </select>
            ) : ( // type 'text'
              <input
                type={field.type}
                id={`edit-${field.name}`}
                value={(eventToEdit as any)[field.name] || ''}
                onChange={(e) => onEventChange(field.name, e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-[var(--theme-input-bg)] border border-[var(--theme-input-border)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-input-border-focus)] focus:border-[var(--theme-input-border-focus)] sm:text-sm text-[var(--theme-text-primary)]"
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end space-x-3">
        <button
          onClick={onCancel}
          type="button"
          className="px-4 py-2 bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] font-semibold rounded-md shadow-sm hover:bg-[var(--theme-bg-tertiary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--theme-border-secondary)]"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          type="button"
          className="px-4 py-2 bg-[var(--theme-button-bg)] text-white font-semibold rounded-md shadow-sm hover:bg-[var(--theme-button-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--theme-border-secondary)]"
        >
          Apply Changes (to local)
        </button>
      </div>
    </div>
  );
}
