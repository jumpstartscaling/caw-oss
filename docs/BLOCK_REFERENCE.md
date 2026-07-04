# Block Reference

CAW uses a block-based rendering system. A page (`caw_content.blocks`) is a JSON array of blocks. `server/blocks.js` iterates over this array and renders HTML.

## Standard Blocks

### `hero`
Primary page header with a large headline.
```json
{
  "block_type": "hero",
  "data": {
    "badge": "OPTIONAL EYEBROW TEXT",
    "headline": "Main Title (supports HTML like <br> or <span class=\"text-neon\">)",
    "subhead": "Secondary text below headline",
    "cta_label": "Button Text",
    "cta_href": "#contact",
    "warning_text": "Small text below the button (optional)"
  }
}
```

### `terminal_problem`
A split layout showing text on the left and a "terminal" window of logs on the right.
```json
{
  "block_type": "terminal_problem",
  "data": {
    "eyebrow": "// SYSTEM_ERROR",
    "title": "The Problem",
    "body": "Description of the problem...",
    "bullets": ["Point 1", "Point 2"],
    "terminal_logs": [
      { "time": "09:00:01", "msg": "Error starting system." }
    ],
    "status_text": "_ SYSTEM_UNSTABLE"
  }
}
```

### `solution_cards`
A grid of 3 cards highlighting solutions.
```json
{
  "block_type": "solution_cards",
  "data": {
    "eyebrow": "// THE_FIX",
    "title": "Section Title",
    "cards": [
      {
        "title": "Card 1",
        "body": "Card 1 body text",
        "border_color": "neon-blue" // neon-blue, neon-green, neon-pink
      }
    ]
  }
}
```

### `audit_form`
A lead generation form component. Posts data to `/api/submit-lead`.
```json
{
  "block_type": "audit_form",
  "data": {
    "title": "Strategy Session",
    "subhead": "Let's find the bottleneck.",
    "form_title": "INITIATE_HANDSHAKE",
    "submit_source": "CAWSite"
  }
}
```

## Adding New Blocks
To add a new block type, add a new `case` statement to the `switch` block in `server/blocks.js`. The block should return an HTML string. Ensure you use the `esc()` function to escape user data to prevent XSS.
