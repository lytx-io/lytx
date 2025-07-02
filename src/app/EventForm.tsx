"use client";

// import React from 'react';
import type { pageEvent } from "@/templates/lytxpixel";

export interface EventFieldDefinition {
  name: keyof pageEvent;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
}

interface EventFormProps {
  eventToEdit: pageEvent;
  eventFields: EventFieldDefinition[];
  onEventChange: (fieldName: keyof pageEvent, value: any) => void;
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
    <div className="p-6 border rounded-lg bg-white shadow-md">
      <h3 className="text-xl font-semibold mb-4 text-indigo-700">
        Edit Event: {eventToEdit.event_name || 'New Event'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {eventFields.map(field => (
          <div key={field.name}>
            <label htmlFor={`edit-${field.name}`} className="block text-sm font-medium text-gray-700">
              {field.label}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={`edit-${field.name}`}
                value={(eventToEdit as any)[field.name] || ''}
                onChange={(e) => onEventChange(field.name, e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            ) : field.type === 'select' ? (
              <select
                id={`edit-${field.name}`}
                value={(eventToEdit as any)[field.name] || ''}
                onChange={(e) => onEventChange(field.name, e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end space-x-3">
        <button
          onClick={onCancel}
          type="button"
          className="px-4 py-2 bg-gray-300 text-gray-700 font-semibold rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          type="button"
          className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Apply Changes (to local)
        </button>
      </div>
    </div>
  );
}
