"""Import the supplied PDFs and workbooks without modifying their content."""
import argparse
import json
import re
import statistics
from pathlib import Path

import fitz
import openpyxl


def extract_paragraphs(path):
    paragraphs = []
    with fitz.open(path) as document:
        for page in document:
            fragments = []
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    text = "".join(span["text"] for span in line["spans"])
                    if not text.strip() or re.match(r"\s*(Step\s*\d|Story\s*\d)", text):
                        continue
                    fragments.append((line["bbox"], text))
            rows = []
            for box, text in sorted(fragments, key=lambda x: (x[0][1], x[0][0])):
                center = (box[1] + box[3]) / 2
                match = next((row for row in reversed(rows[-3:]) if abs(row[0] - center) < 10), None)
                if match:
                    match[1].append((box[0], text))
                else:
                    rows.append([center, [(box[0], text)]])
            rows.sort(key=lambda row: row[0])
            gaps = [rows[i][0] - rows[i - 1][0] for i in range(1, len(rows))]
            normal = statistics.median(gaps) if gaps else 30
            current = ""
            previous_y = None
            for y, chunks in rows:
                if previous_y is not None and y - previous_y > normal * 1.55:
                    if current:
                        paragraphs.append(current)
                    current = ""
                text = "".join(t for _, t in sorted(chunks))
                # Spaces are layout artifacts in these Chinese paragraphs. Keep
                # genuine spaces inside English phrases, if present.
                text = re.sub(r"(?<=[\u3400-\u9fff，。！？、：；‘’“”（）])\s+|\s+(?=[\u3400-\u9fff，。！？、：；‘’“”（）])", "", text)
                if current and re.search(r"[a-zA-Z]$", current) and re.match(r"[a-zA-Z]", text):
                    current += " "
                current += text.strip()
                previous_y = y
            if current:
                paragraphs.append(current)
    return paragraphs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "stories.js")
    args = parser.parse_args()
    stories = []
    issues = []
    for folder in sorted(args.source.iterdir(), key=lambda p: int(p.name.split("、")[0]) if re.match(r"\d+、", p.name) else 9999):
        if not folder.is_dir() or not re.match(r"\d+、", folder.name):
            continue
        number, title = folder.name.split("、", 1)
        pdf = next(folder.glob("*学习版.pdf"))
        workbook = openpyxl.load_workbook(folder / "重点单词.xlsx", read_only=True, data_only=True)
        words = [[str(row[1]).strip(), str(row[2]).strip()] for row in list(workbook.active.values)[1:] if row[1] and row[2]]
        workbook.close()
        paragraphs = extract_paragraphs(pdf)
        text = "\n".join(paragraphs)
        alternatives = "|".join(re.escape(word) for word, _ in sorted(words, key=lambda pair: -len(pair[0])))
        annotations = re.findall(r"(?<![A-Za-z])(" + alternatives + r")（([^（）]+)）", text, flags=re.I)
        annotations = [(word.strip(), meaning.strip()) for word, meaning in annotations]
        # Every workbook entry must be present in the imported text. Fail rather
        # than publish a story with a dropped or broken word.
        normalized = {re.sub(r"\s+", " ", word).casefold() for word, _ in annotations}
        missing = [word for word, _ in words if word.casefold() not in normalized]
        if missing:
            issues.append({"story": int(number), "missing": missing})
        stories.append({"id": int(number), "title": title, "paragraphs": paragraphs, "words": words,
                        "minutes": max(3, round(len(text) / 320)), "credit": "书豪团队原创"})
    if len(stories) != 100 or [s["id"] for s in stories] != list(range(1, 101)):
        raise ValueError("Expected exactly stories 1 through 100")
    if issues:
        print(json.dumps(issues, ensure_ascii=False, indent=2))
        raise ValueError("Imported text does not cover all vocabulary entries")
    vocabulary = {word.casefold() for s in stories for word, _ in s["words"]}
    payload = {"version": 1, "credit": "故事与原始词表：书豪团队原创；网页整理用于个人英语学习。",
               "totalEntries": sum(len(s["words"]) for s in stories), "uniqueWords": len(vocabulary), "stories": stories}
    args.output.write_text("// Imported from the supplied learning PDFs and vocabulary workbooks.\nwindow.STORYWORDS = " +
                           json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(json.dumps({"stories": len(stories), "paragraphs": sum(len(s["paragraphs"]) for s in stories),
                      "vocabularyEntries": payload["totalEntries"], "uniqueWords": len(vocabulary), "bytes": args.output.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
