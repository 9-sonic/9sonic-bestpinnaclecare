require "zip"

module Notes
  module Exporters
    # Renders the filtered visit notes to a Word .docx.
    #
    # A .docx is just a zip of a few OOXML parts. Every maintained Ruby Word gem
    # pins rubyzip ~> 1.x, which would drag caxlsx and rubyzip backwards (caxlsx
    # powers the existing XLSX exports), so instead we write the minimal OOXML by
    # hand over the rubyzip 3.x already in the tree. The document is deliberately
    # simple — a heading, a filter summary, then one styled block per note — which
    # is all the office needs and keeps the XML we hand-author small and safe.
    #
    # `rows` are Notes::Query.row hashes; `meta[:summary]` is the filter summary.
    class DocxExporter
      def self.call(rows:, meta:)
        new(rows, meta).render
      end

      def initialize(rows, meta)
        @rows = rows
        @meta = meta
      end

      def render
        buffer = Zip::OutputStream.write_buffer do |zip|
          write(zip, "[Content_Types].xml", content_types)
          write(zip, "_rels/.rels", root_rels)
          write(zip, "word/_rels/document.xml.rels", document_rels)
          write(zip, "word/styles.xml", styles)
          write(zip, "word/document.xml", document)
        end
        buffer.string
      end

      private

      def write(zip, name, body)
        zip.put_next_entry(name)
        zip.write(body)
      end

      # --- document body -----------------------------------------------------

      def document
        <<~XML.strip
          <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
              #{title_para('Care notes', 'Title')}
              #{plain_para(@meta[:summary], 'Subtitle')}
              #{plain_para(export_line, 'Subtitle')}
              #{body_paras}
            </w:body>
          </w:document>
        XML
      end

      def body_paras
        return plain_para("No notes match these filters.", "Subtitle") if @rows.empty?

        @rows.map { |row| note_block(row) }.join("\n")
      end

      def note_block(row)
        [ title_para(meta_line(row), "NoteMeta"), plain_para(row[:body].to_s, "Normal") ].join("\n")
      end

      def meta_line(row)
        date   = format_date(row[:visit_scheduled_start])
        carer  = row[:employee_name] || row[:author_name] || "—"
        client = row[:service_user_name] || "—"
        "#{date}   ·   #{carer}  →  #{client}"
      end

      def export_line
        "#{@rows.size} note#{'s' unless @rows.size == 1} · exported #{Time.current.strftime('%-d %b %Y, %H:%M')}"
      end

      # A paragraph whose run is bold (used for the title and each note's meta).
      def title_para(text, style)
        <<~XML.strip
          <w:p><w:pPr><w:pStyle w:val="#{style}"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">#{esc(text)}</w:t></w:r></w:p>
        XML
      end

      # A plain paragraph. Multi-line bodies keep their line breaks via <w:br/>.
      def plain_para(text, style)
        runs = text.to_s.split("\n", -1).map { |line| esc(line) }.join('</w:t></w:r><w:r><w:br/><w:t xml:space="preserve">')
        <<~XML.strip
          <w:p><w:pPr><w:pStyle w:val="#{style}"/></w:pPr><w:r><w:t xml:space="preserve">#{runs}</w:t></w:r></w:p>
        XML
      end

      # --- static parts ------------------------------------------------------

      def content_types
        <<~XML.strip
          <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
            <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
          </Types>
        XML
      end

      def root_rels
        <<~XML.strip
          <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
          </Relationships>
        XML
      end

      def document_rels
        <<~XML.strip
          <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
          </Relationships>
        XML
      end

      def styles
        <<~XML.strip
          <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
          <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
            <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:sz w:val="40"/></w:rPr></w:style>
            <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:color w:val="6B7A8D"/><w:sz w:val="18"/></w:rPr></w:style>
            <w:style w:type="paragraph" w:styleId="NoteMeta"><w:name w:val="NoteMeta"/><w:pPr><w:spacing w:before="240" w:after="40"/></w:pPr><w:rPr><w:color w:val="6B7A8D"/><w:sz w:val="18"/></w:rPr></w:style>
          </w:styles>
        XML
      end

      # --- helpers -----------------------------------------------------------

      def esc(str)
        str.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;").gsub('"', "&quot;")
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
