<?php

declare(strict_types=1);

/**
 * Inline stroke icons (Lucide-style geometry, no external assets or fonts).
 * Keeping them inline means the panel renders with zero network requests.
 */
function btp_icon(string $name, int $size = 18, string $class = ''): string
{
    static $paths = [
        'grid' => '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
        'server' => '<rect x="2.5" y="3" width="19" height="7" rx="2"/><rect x="2.5" y="14" width="19" height="7" rx="2"/><path d="M6.5 6.5h.01M6.5 17.5h.01"/>',
        'users' => '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16.5 3.6a3.5 3.5 0 0 1 0 6.8"/>',
        'activity' => '<path d="M22 12h-4l-3 8-4-16-3 8H2"/>',
        'settings' => '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
        'logout' => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
        'plus' => '<path d="M12 5v14M5 12h14"/>',
        'play' => '<path d="M6 3.5 20 12 6 20.5z"/>',
        'stop' => '<rect x="5.5" y="5.5" width="13" height="13" rx="2"/>',
        'restart' => '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
        'terminal' => '<path d="m5 7 5 5-5 5"/><path d="M13 17h6"/>',
        'folder' => '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        'folder-plus' => '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
        'file' => '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
        'archive' => '<rect x="3" y="3.5" width="18" height="5" rx="1.5"/><path d="M4.5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h12A1.5 1.5 0 0 0 19.5 19V8.5"/><path d="M10 12.5h4"/>',
        'shield' => '<path d="M12 21s7-3.5 7-9V5.5L12 3 5 5.5V12c0 5.5 7 9 7 9z"/>',
        'cpu' => '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
        'memory' => '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10v4M10 10v4M14 10v4M18 10v4"/>',
        'disk' => '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M2.5 13h19"/><path d="M6.5 16.5h.01M10 16.5h.01"/>',
        'download' => '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
        'upload' => '<path d="M12 16V4"/><path d="m7 8 5-5 5 5"/><path d="M4 20h16"/>',
        'trash' => '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
        'pencil' => '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 6.5 3 3"/>',
        'refresh' => '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
        'power' => '<path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/>',
        'x' => '<path d="M6 6l12 12M18 6 6 18"/>',
        'check' => '<path d="m4 12.5 5.5 5.5L20 6"/>',
        'alert' => '<path d="M12 3 2.5 20h19z"/><path d="M12 9.5v4.5M12 17h.01"/>',
        'external' => '<path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
        'search' => '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        'globe' => '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
        'key' => '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/><path d="m17 4 3 3"/><path d="m14.5 6.5 3 3"/>',
        'chevron' => '<path d="m9 6 6 6-6 6"/>',
        'back' => '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
        'wifi' => '<path d="M3 9a15 15 0 0 1 18 0"/><path d="M6.5 12.5a10 10 0 0 1 11 0"/><path d="M10 16a5 5 0 0 1 4 0"/><path d="M12 19.5h.01"/>',
        'clock' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        'user' => '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        'lock' => '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
        'mail' => '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    ];

    $path = $paths[$name] ?? $paths['file'];
    $classAttribute = $class !== '' ? ' class="' . btp_e($class) . '"' : '';
    return sprintf(
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"%s aria-hidden="true">%s</svg>',
        $size,
        $size,
        $classAttribute,
        $path,
    );
}

/**
 * Brand mark used in the sidebar and on the login screen.
 */
function btp_brand_mark(int $size = 22): string
{
    return sprintf(
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7z"/>
            <path d="M3.5 7 12 11.5 20.5 7"/>
            <path d="M12 11.5v10"/>
            <path d="M7.8 9.3v5.2L12 17l4.2-2.5V9.3"/>
        </svg>',
        $size,
        $size,
    );
}
