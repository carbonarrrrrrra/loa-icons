# LoA Icons

Unofficial JP Princess Connect! Re:Dive WebP icon library.

https://carbonarrrrrrra.github.io/loa-icons/

The hourly GitHub Actions workflow checks Expugn/priconne-database directly for the JP version and unit names (the CSV diff mirror can lag), pins metadata and database to one commit, verifies the database LFS SHA256 and size, and validates the official asset manifest and bundle MD5, extracts new icons using UnityPy, and deploys GitHub Pages. Existing image files remain available. Failed extraction stops publication. Source schema changes require maintenance. GitHub schedules can be delayed and inactive repository schedules may be disabled after 60 days; check Actions if updates stop.

Images belong to Cygames and their respective owners. This is an unofficial fan utility.

Formation sorting defaults to front-to-back. Unit positions are extracted with names from the master database; ties use ascending unit ID in both directions. Explicit tail groups are defined in site/formation.js (combined-character component assets, duplicate Djeeta, zero-position trio, protagonist variants). Missing positions are placed after normal units and before explicit tail groups. Existing image URLs and sheet row ordering are unchanged.
