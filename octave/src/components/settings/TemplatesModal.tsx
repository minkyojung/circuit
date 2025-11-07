/**
 * TemplatesModal - Browse and apply AI rule templates
 */

import React, { useState } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { getAIRules, addAIRule } from '@/services/projectConfig';

// Import templates
import reactTypescriptTemplate from '@/templates/aiRules/react-typescript.json';
import nextjsTemplate from '@/templates/aiRules/nextjs.json';
import nodejsApiTemplate from '@/templates/aiRules/nodejs-api.json';
import pythonFastapiTemplate from '@/templates/aiRules/python-fastapi.json';
import rustTemplate from '@/templates/aiRules/rust.json';
import goTemplate from '@/templates/aiRules/go.json';
import typescriptTemplate from '@/templates/aiRules/typescript.json';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  onApply?: () => void;
}

const TEMPLATES = [
  { key: 'react-typescript', data: reactTypescriptTemplate, icon: '⚛️' },
  { key: 'nextjs', data: nextjsTemplate, icon: '▲' },
  { key: 'nodejs-api', data: nodejsApiTemplate, icon: '🟢' },
  { key: 'python-fastapi', data: pythonFastapiTemplate, icon: '🐍' },
  { key: 'rust', data: rustTemplate, icon: '🦀' },
  { key: 'go', data: goTemplate, icon: '🔷' },
  { key: 'typescript', data: typescriptTemplate, icon: '🔷' },
];

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  workspacePath,
  onApply,
}) => {
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const handleApplyTemplate = async (templateKey: string) => {
    setApplying(templateKey);
    try {
      const template = TEMPLATES.find((t) => t.key === templateKey);
      if (!template) return;

      // Get existing rules to append to them
      const existingRules = await getAIRules(workspacePath);

      // Add template rules
      for (const rule of template.data.rules) {
        await addAIRule(workspacePath, {
          content: rule,
          enabled: true,
          category: 'general',
        });
      }

      console.log(`Applied ${template.data.rules.length} rules from ${template.data.name}`);
      setApplied(templateKey);
      onApply?.();

      // Reset after 2 seconds
      setTimeout(() => setApplied(null), 2000);
    } catch (error) {
      console.error('Failed to apply template:', error);
      alert('Failed to apply template');
    } finally {
      setApplying(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] m-4 bg-background border border-border rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Rule Templates</h2>
              <p className="text-xs text-muted-foreground">Apply pre-built rule sets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">
            {TEMPLATES.map((template) => (
              <div
                key={template.key}
                className="group flex items-center justify-between p-4 bg-muted/20 border border-border rounded-lg hover:bg-muted/30 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground">
                      {template.data.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {template.data.description}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {template.data.rules.length} rules
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleApplyTemplate(template.key)}
                  disabled={applying !== null}
                  className="flex-shrink-0 ml-4 px-4 py-2 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {applied === template.key ? (
                    <>
                      <Check size={14} />
                      Applied
                    </>
                  ) : applying === template.key ? (
                    'Applying...'
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Apply
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Info box */}
          <div className="mt-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">💡 How templates work:</span><br />
              Applying a template will add its rules to your project-specific rules.
              This does not replace existing rules—it appends to them. You can edit
              or remove individual rules after applying a template.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
