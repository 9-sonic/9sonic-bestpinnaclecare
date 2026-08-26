# DejaVu fonts

`DejaVuSans.ttf` and `DejaVuSans-Bold.ttf` are vendored so the care-notes PDF
export (`Notes::Exporters::PdfExporter`) can render any character a carer types
into a note — Prawn's built-in AFM fonts only cover Windows-1252, which crashes
on accents, smart quotes, arrows, emoji, etc. Vendoring (rather than reading a
system font path) means the export works identically on the Virtualmin box, in
CI, and locally, with no font package to install.

DejaVu fonts are released under a permissive, embeddable license derived from
the Bitstream Vera license (free to use, embed and redistribute). See
https://dejavu-fonts.github.io/License.html for the full text.
