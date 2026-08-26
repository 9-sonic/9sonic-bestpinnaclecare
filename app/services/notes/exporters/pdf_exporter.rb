require "prawn"
require "prawn/table"

module Notes
  module Exporters
    # Renders the filtered visit notes to a PDF, one note per block with its
    # visit date, carer and client, so a care manager can print or file the
    # journal. Same rows as the on-screen list (both go through Notes::Query).
    #
    # `rows` are Notes::Query.row hashes; `meta` carries the human-readable
    # filter summary drawn under the title (who/which client/date range).
    class PdfExporter
      INK = "1F2933".freeze
      MUTED = "6B7A8D".freeze
      RULE = "D9E0E7".freeze

      # Vendored UTF-8 font. Prawn's built-in AFM fonts are Windows-1252 only and
      # raise on any character outside it — accents, smart quotes, arrows, emoji —
      # which carers WILL type into notes. Embedding DejaVu makes the export
      # render real note text safely regardless of the host.
      FONT_DIR = Rails.root.join("app/assets/fonts/dejavu")

      def self.call(rows:, meta:)
        new(rows, meta).render
      end

      def initialize(rows, meta)
        @rows = rows
        @meta = meta
      end

      def render
        doc = Prawn::Document.new(page_size: "A4", margin: 40)
        doc.font_families.update(
          "DejaVu" => {
            normal: FONT_DIR.join("DejaVuSans.ttf").to_s,
            bold: FONT_DIR.join("DejaVuSans-Bold.ttf").to_s
          }
        )
        doc.font "DejaVu"
        heading(doc)
        if @rows.empty?
          doc.move_down 24
          doc.fill_color MUTED
          doc.text "No notes match these filters.", size: 12
          doc.fill_color INK
        else
          @rows.each_with_index { |row, i| note_block(doc, row, i.zero?) }
        end
        footer(doc)
        doc.render
      end

      private

      def heading(doc)
        doc.fill_color INK
        doc.text "Care notes", size: 20, style: :bold
        doc.move_down 4
        doc.fill_color MUTED
        doc.text @meta[:summary], size: 10
        doc.text "#{@rows.size} note#{'s' unless @rows.size == 1} · exported #{Time.current.strftime('%-d %b %Y, %H:%M')}", size: 9
        doc.fill_color INK
        doc.move_down 10
        doc.stroke_color RULE
        doc.stroke_horizontal_rule
        doc.stroke_color "000000"
      end

      def note_block(doc, row, first)
        doc.move_down(first ? 16 : 18)
        # Meta line: date · carer → client
        doc.fill_color MUTED
        doc.text meta_line(row), size: 9, style: :bold
        doc.fill_color INK
        doc.move_down 4
        doc.text row[:body].to_s, size: 11, leading: 2
      end

      def meta_line(row)
        date = format_date(row[:visit_scheduled_start])
        carer = row[:employee_name] || row[:author_name] || "—"
        client = row[:service_user_name] || "—"
        "#{date}   ·   #{carer}  →  #{client}"
      end

      def footer(doc)
        doc.number_pages "Best Pinnacle Care — care notes — page <page> of <total>",
                         at: [ 0, 0 ], align: :center, size: 8, color: MUTED
      end

      def format_date(iso)
        return "—" if iso.blank?

        Time.zone.parse(iso).strftime("%a %-d %b %Y, %H:%M")
      rescue ArgumentError, TypeError
        iso
      end
    end
  end
end
