import { escapeHtml } from './utils';

/**
 * Substitutes variables in an HTML template securely.
 * Replaces both {{key}} and [key] formats with their corresponding values from the variables object.
 * Applies HTML escaping to all values to prevent XSS.
 *
 * @param template The HTML string template
 * @param variables Object containing the keys and values to substitute
 * @returns The HTML string with substituted, escaped values
 */
export function substituteVariables(template: string, variables: Record<string, string>): string {
  let html = template;

  Object.entries(variables).forEach(([key, value]) => {
    // Determine the key to replace based on how it's formatted in the variables object
    // If the key already has {{}} or [] delimiters, use it exactly
    // Otherwise, generate regexes for both {{key}} and [key]

    const stringVal = String(value);

    if (key.startsWith('{{') && key.endsWith('}}')) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escapedKey, 'g'), () => escapeHtml(stringVal));
    } else if (key.startsWith('[') && key.endsWith(']')) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escapedKey, 'g'), () => escapeHtml(stringVal));
    } else {
      // Key is plain string like 'company_name', replace both {{company_name}} and [company_name]
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Replace {{key}}
      html = html.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'gi'), () => escapeHtml(stringVal));

      // Replace [key]
      html = html.replace(new RegExp(`\\[${escapedKey}\\]`, 'gi'), () => escapeHtml(stringVal));
    }
  });

  return html;
}
