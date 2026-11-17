# LoA Icons

Unofficial JP Princess Connect! Re:Dive WebP icon library.

https://carbonarrrrrrra.github.io/loa-icons/

The hourly GitHub Actions workflow checks Expugn/priconne-database directly for the JP version and unit names (the CSV diff mirror can lag), pins metadata and database to one commit, verifies the database LFS SHA256 and size, and validates the official asset manifest and bundle MD5, extracts new icons using UnityPy, and deploys GitHub Pages. Existing image files remain available. Failed extraction stops publication. Source schema changes require maintenance. GitHub schedules can be delayed and inactive repository schedules may be disabled after 60 days; check Actions if updates stop.

Images belong to Cygames and their respective owners. This is an unofficial fan utility.

The catalog defaults to Japanese name order. Optional formation sorting uses positions from the master database; ties use ascending unit ID in both directions. Explicit tail groups are defined in site/formation.js (combined-character component assets, duplicate Djeeta, zero-position trio, protagonist variants). Missing positions are placed after normal units and before explicit tail groups. Existing image URLs, spreadsheet export and sheet row ordering are unchanged.

`tier.html` provides editable tier names, colors and row order (1–30 tiers), click/drag placement, undo, PNG export and JSON backups. `owned.html` provides ownership toggles, element totals, bulk changes and the same backup/export controls. Both use browser localStorage; no account or server is required. Ownership can filter the tier character pool. Saves are specific to the browser and origin, so export a backup before switching devices or clearing site data. Newly published catalog entries appear automatically without changing existing saved selections.

Element and attack-type metadata come from the JP master database. Element IDs are 1=fire, 2=water, 3=wind, 4=light and 5=dark. The five element sprites are lossless WebP crops of the official `AtlasUnitCommonTalent` bundle (`icon_talent_001`–`005`); `scripts/extract_elements.py` reproduces them with a pinned checksum. Characters with missing attributes and special component/NPC assets are available through the optional special-assets filter. The catalog override for icon 107311 is ラジラジ and is reapplied by the updater.
