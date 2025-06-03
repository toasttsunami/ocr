logs
- initial plan: use tesseract for ocr and text detection and pass it through a llm to get structured outputs.
- initial tests with tesseract gave bad results
    reasons:
      1. tesseract is for single line text
      2. it performs poorly for handwritten text
- tried to attempt to finetune tesseract lstm model
  - looked up how to create bounding boxes for words and label them.
  - tried jtessbox to create bb and label, unsuccessful

- realized tess is generally used for printed text and performs poorly on handwriten text.
- looked up handwriting text detection tools, found HTR tools, tried TrOCR
- trocr on initial test gave bad res also.
- looked up how to finetune trocr
- found c