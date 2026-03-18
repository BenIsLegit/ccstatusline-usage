import chalk from 'chalk';

import { getColorLevelString } from '../types/ColorLevel';
import type { Settings } from '../types/Settings';

import { applyColors } from './colors';
import type { PreRenderedWidget } from './renderer';
import { getWidget } from './widgets';

/**
 * Render all widgets in compact flex-wrap mode for narrow terminals.
 * Widgets flow left-to-right with ` | ` separators, wrapping to a new
 * line at widget boundaries (never mid-widget).
 */
export function renderCompactOutput(
    preRenderedLines: PreRenderedWidget[][],
    settings: Settings,
    maxWidth: number
): void {
    const colorLevel = getColorLevelString(settings.colorLevel);
    const sep = settings.defaultSeparator ?? '|';
    const separatorText = sep === '|' ? ' | ' : ` ${sep} `;
    const separatorWidth = separatorText.length;

    // Collect all renderable widgets across all lines, applying colors
    const coloredWidgets: { colored: string; width: number }[] = [];
    for (const line of preRenderedLines) {
        for (const pw of line) {
            if (pw.widget.type === 'separator' || pw.widget.type === 'flex-separator')
                continue;
            if (pw.plainLength === 0)
                continue;

            // Resolve foreground color: widget override → widget default → white
            let fgColor = pw.widget.color;
            if (!fgColor) {
                const impl = getWidget(pw.widget.type);
                fgColor = impl ? impl.getDefaultColor() : 'white';
            }
            let bgColor = pw.widget.backgroundColor;

            // Apply global overrides
            if (settings.overrideForegroundColor && settings.overrideForegroundColor !== 'none')
                fgColor = settings.overrideForegroundColor;
            if (settings.overrideBackgroundColor && settings.overrideBackgroundColor !== 'none')
                bgColor = settings.overrideBackgroundColor;

            const bold = settings.globalBold || pw.widget.bold;
            const colored = applyColors(pw.content, fgColor, bgColor, bold, colorLevel);
            coloredWidgets.push({ colored, width: pw.plainLength });
        }
    }

    if (coloredWidgets.length === 0)
        return;

    // Build output lines with flex-wrap at widget boundaries
    const outputLines: string[] = [];
    let currentLine = '';
    let currentWidth = 0;

    for (const cw of coloredWidgets) {
        const needed = currentWidth === 0 ? cw.width : separatorWidth + cw.width;

        if (currentWidth > 0 && currentWidth + needed > maxWidth) {
            // Widget doesn't fit — wrap to new line
            outputLines.push(currentLine);
            currentLine = cw.colored;
            currentWidth = cw.width;
        } else {
            if (currentWidth > 0) {
                currentLine += chalk.gray(separatorText);
                currentWidth += separatorWidth;
            }
            currentLine += cw.colored;
            currentWidth += cw.width;
        }
    }
    if (currentLine)
        outputLines.push(currentLine);

    for (const line of outputLines) {
        let outputLine = line.replace(/ /g, '\u00A0');
        outputLine = '\x1b[0m' + outputLine;
        console.log(outputLine);
    }
}