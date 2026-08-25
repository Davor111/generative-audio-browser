/**
 * Schema-driven right-click editors.
 *
 * Every element editor is the same dialog: a header, some labelled controls,
 * live readouts, close-on-button / close-on-backdrop. Only three things ever
 * differ — which fields exist, how each reads back off the element, and how
 * each writes through to Tone. So editors declare those three things and this
 * module builds the markup, wires the events, and owns the open/close state.
 *
 * The generated ids match the hand-written markup this replaced
 * (`<prefix>-edit-<name>`, readouts `<prefix>-edit-<name>-value`) because the
 * Playwright suite addresses controls by id.
 */

/** Live-readout formatters. The suite asserts on these exact strings. */
export const fmt = {
  unit: (raw: string) => Number(raw).toFixed(2),
  seconds: (raw: string) => `${Number(raw).toFixed(2)}s`,
  ms: (raw: string) => `${raw}ms`,
  percent: (raw: string) => `${Math.round(Number(raw) * 100)}%`,
  hz: (raw: string) => `${Number(raw).toFixed(2)}Hz`,
  hzWhole: (raw: string) => `${raw}Hz`,
  octaves: (raw: string) => `${Number(raw).toFixed(1)} oct`,
};

interface FieldBase<T> {
  /** Suffix of the control id: `<prefix>-edit-<name>`. */
  name: string;
  label?: string;
  /** Restores the control when the dialog opens. */
  read: (state: T) => number | string | boolean;
  /** Applies the control's raw string value to the element. */
  write: (state: T, raw: string) => void;
}

export interface RangeField<T> extends FieldBase<T> {
  kind: 'range';
  min: number;
  max: number;
  step: number;
  /** Omit for a slider with no live readout. */
  format?: (raw: string) => string;
}

export interface SelectField<T> extends FieldBase<T> {
  kind: 'select';
  /** `[value, label]` pairs. */
  options: Array<[string, string]>;
}

export interface CheckboxField<T> extends FieldBase<T> {
  kind: 'checkbox';
  /** `write` receives 'true' or 'false'; use `isChecked` to read it. */
  read: (state: T) => boolean;
}

export type Field<T> = RangeField<T> | SelectField<T> | CheckboxField<T>;

/** Reads a CheckboxField's raw value in a `write`. */
export const isChecked = (raw: string): boolean => raw === 'true';

export interface Section<T> {
  /** Omit for an untitled section (the single-column editors). */
  title?: string;
  /** Two-column grid instead of a stacked column. */
  grid?: boolean;
  /** Small print rendered under the section. */
  note?: string;
  fields: Array<Field<T>>;
}

export interface EditorSpec<T> {
  /** Id stem — 'orb' yields `#orb-edit-dialog`, `#orb-edit-form`, … */
  prefix: string;
  title: string;
  /** Accent colour for readouts, section headings and slider thumbs. */
  accent: string;
  /** Slider-thumb glow. */
  glow: string;
  /** The dialog's two drop shadows. */
  shadow: [string, string];
  /** Dialog max-width; the grouped Power Synth editor needs more room. */
  width: string;
  sections: Array<Section<T>>;
}

export interface Editor<T> {
  open(state: T): void;
  bindContextMenu(state: T): void;
}

function buildField<T>(prefix: string, field: Field<T>): HTMLElement {
  const id = `${prefix}-edit-${field.name}`;

  const wrapper = document.createElement('label');
  wrapper.className = 'edit-field';

  if (field.label) {
    const label = document.createElement('span');
    label.className = 'edit-label';
    label.textContent = field.label;

    if (field.kind === 'range' && field.format) {
      const readout = document.createElement('span');
      readout.className = 'edit-value';
      readout.id = `${id}-value`;
      // A leading space keeps "Attack 0.42s" reading as one phrase when the
      // flex row wraps or is read aloud.
      label.append(' ', readout);
    }

    wrapper.append(label);
  }

  if (field.kind === 'checkbox') {
    wrapper.classList.add('edit-field-check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    wrapper.append(input);
  } else if (field.kind === 'select') {
    const select = document.createElement('select');
    select.id = id;
    for (const [value, text] of field.options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    wrapper.append(select);
  } else {
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    wrapper.append(input);
  }

  return wrapper;
}

export function createEditor<T extends { el: HTMLElement }>(spec: EditorSpec<T>): Editor<T> {
  const { prefix } = spec;
  const fields = spec.sections.flatMap((section) => section.fields);

  const dialog = document.createElement('dialog');
  dialog.id = `${prefix}-edit-dialog`;
  dialog.className = 'edit-dialog';
  dialog.style.setProperty('--edit-accent', spec.accent);
  dialog.style.setProperty('--edit-glow', spec.glow);
  dialog.style.setProperty('--edit-shadow-1', spec.shadow[0]);
  dialog.style.setProperty('--edit-shadow-2', spec.shadow[1]);
  dialog.style.setProperty('--edit-width', spec.width);

  const form = document.createElement('form');
  form.id = `${prefix}-edit-form`;
  // method="dialog" so Enter closes rather than navigating.
  form.method = 'dialog';

  const header = document.createElement('div');
  header.className = 'edit-header';
  const heading = document.createElement('h2');
  heading.textContent = spec.title;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.id = `${prefix}-edit-close`;
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  header.append(heading, closeBtn);
  form.append(header);

  for (const section of spec.sections) {
    if (section.title) {
      const groupHeading = document.createElement('h3');
      groupHeading.className = 'edit-group';
      groupHeading.textContent = section.title;
      form.append(groupHeading);
    }

    const body = document.createElement('div');
    body.className = section.grid ? 'edit-section edit-grid' : 'edit-section';
    for (const field of section.fields) {
      body.append(buildField(prefix, field));
    }
    form.append(body);

    if (section.note) {
      const note = document.createElement('p');
      note.className = 'edit-note';
      note.textContent = section.note;
      form.append(note);
    }
  }

  dialog.append(form);
  (document.querySelector('main') ?? document.body).append(dialog);

  const controls = new Map<Field<T>, HTMLInputElement | HTMLSelectElement>(
    fields.map((field) => [
      field,
      document.getElementById(`${prefix}-edit-${field.name}`) as HTMLInputElement,
    ]),
  );
  const readouts = new Map<Field<T>, HTMLSpanElement>();
  for (const field of fields) {
    const readout = document.getElementById(`${prefix}-edit-${field.name}-value`);
    if (readout) readouts.set(field, readout as HTMLSpanElement);
  }

  /**
   * Checkboxes carry their state on `.checked`, everything else on `.value`.
   * Normalising both to a string here keeps one read/write path for all kinds.
   */
  function controlValue(field: Field<T>): string {
    const control = controls.get(field)!;
    return field.kind === 'checkbox'
      ? String((control as HTMLInputElement).checked)
      : control.value;
  }

  function restoreControl(field: Field<T>, state: T): void {
    const control = controls.get(field)!;
    if (field.kind === 'checkbox') {
      (control as HTMLInputElement).checked = Boolean(field.read(state));
    } else {
      control.value = String(field.read(state));
    }
  }

  let current: T | null = null;

  function refreshValueLabels(): void {
    for (const [field, readout] of readouts) {
      if (field.kind !== 'range' || !field.format) continue;
      readout.textContent = field.format(controlValue(field));
    }
  }

  /**
   * Writes every field, not just the one that changed — each `write` is the
   * single source of truth for its own value, so a blanket apply stays
   * correct and avoids per-field event plumbing.
   */
  function applyFields(): void {
    if (!current) return;
    for (const field of fields) {
      field.write(current, controlValue(field));
    }
    refreshValueLabels();
  }

  form.addEventListener('input', applyFields);

  closeBtn.addEventListener('click', () => {
    dialog.close();
  });

  dialog.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', () => {
    current = null;
  });

  function open(state: T): void {
    // Restored before `current` is set: assigning `.value` fires no input
    // event, but this keeps a stray apply from writing one element's
    // half-restored controls onto another.
    for (const field of fields) {
      restoreControl(field, state);
    }
    current = state;
    refreshValueLabels();
    dialog.showModal();
  }

  function bindContextMenu(state: T): void {
    state.el.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      open(state);
    });
  }

  return { open, bindContextMenu };
}
