"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { EventFieldDefinition } from './EventForm';
import type { PageEvent } from "@/templates/lytxpixel";

const debug = true;

interface EditableCellProps {
  initialValue: any;
  isEditing: boolean;
  fieldDefinition: EventFieldDefinition;
  eventId: string;
  columnId: keyof PageEvent;
  updateData: (eventId: string, columnId: keyof PageEvent, value: any) => void;
  exitEditMode: () => void;
}

const EditableCellComponent: React.FC<EditableCellProps> = ({
  initialValue,
  isEditing,
  fieldDefinition,
  eventId,
  columnId,
  updateData,
  exitEditMode,
}) => {


  // if (debug) {
  //   console.log(`RENDER EditableCell: event='${eventId}' col='${String(columnId)}' isEditing=${isEditing} initialValue='${initialValue}'`);
  // }

  const [currentValue, setCurrentValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);
  const prevIsEditingRef = useRef<boolean>(false);

  useEffect(() => {
    const prevIsEditing = prevIsEditingRef.current;

    // if (debug) {
    //   console.log(`EFFECT EditableCell: event='${eventId}' col='${String(columnId)}'. Prev isEditing: ${prevIsEditing}, Current isEditing: ${isEditing}. InitialValue: '${initialValue}'`);
    // }

    if (isEditing) {
      // Only set currentValue from initialValue if we are just entering edit mode
      if (prevIsEditing === undefined || prevIsEditing === false) {
        setCurrentValue(initialValue);
      }
      if (inputRef.current) {
        inputRef.current.focus();
        if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
          inputRef.current.select();
        }
      }
    }
    prevIsEditingRef.current = isEditing; // Update for the next render
  }, [isEditing]); // <<<< ENSURE THIS IS THE ONLY DEPENDENCY

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setCurrentValue(e.target.value);
    updateData(eventId, columnId, e.target.value);
  };

  const handleBlur = () => {
    exitEditMode();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (fieldDefinition.type !== 'select' || (e.target as HTMLSelectElement).type !== 'select-one') {
        e.preventDefault();
        exitEditMode();
      }
    } else if (e.key === 'Escape') {
      setCurrentValue(initialValue);
      updateData(eventId, columnId, initialValue);
      exitEditMode();
    }
  };

  if (!isEditing) {
    let displayValue: React.ReactNode = initialValue;
    if (fieldDefinition.name === 'Notes' && typeof initialValue === 'string' && initialValue.length > 30) {
      displayValue = `${initialValue.substring(0, 27)}...`;
    } else if (typeof initialValue === 'boolean') {
      displayValue = initialValue ? 'Yes' : 'No';
    } else if (initialValue === null || initialValue === undefined || initialValue === '') {
      displayValue = <span className="text-gray-400 italic">empty</span>;
    }
    return <>{displayValue}</>;
  }

  const commonProps = {
    ref: inputRef as any,
    value: currentValue ?? '',
    onChange: handleChange,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    className: "w-full p-1 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm",
  };

  if (fieldDefinition.type === 'textarea') {
    return <textarea {...commonProps} rows={2} />;
  }

  if (fieldDefinition.type === 'select') {
    return (
      <select {...commonProps}>
        {fieldDefinition.options?.map(option => (
          <option key={option} value={option}>
            {String(option)}
          </option>
        ))}
      </select>
    );
  }

  return <input type="text" {...commonProps} />;
};

export const EditableCell = React.memo(EditableCellComponent);
// export { EditableCellComponent as EditableCell };
