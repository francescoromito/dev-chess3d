import re

def repl(file_path, pattern, replacement):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    content = re.sub(pattern, replacement, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

repl('backend/app/models/__init__.py', r'\s*model_stl:\s*Optional\[str\]\s*=\s*Field\(default=None,\s*max_length=500\)', '')
repl('backend/app/models/__init__.py', r'\s*model_stl:\s*Optional\[str\]\s*=\s*None', '')

repl('backend/app/api/pieces.py', r'\s*model_stl:\s*Optional\[UploadFile\]\s*=\s*File\(None\),?', '')
repl('backend/app/api/pieces.py', r'\s*model_stl=model_stl,?', '')

repl('backend/app/services/piece_version_service.py', r'\s*model_stl:\s*Optional\[UploadFile\]\s*=\s*None,?', '')
repl('backend/app/services/piece_version_service.py', r'\n\s*if model_stl:[\s\S]*?(?=\s*session\.add\(db_version\))', '\n        ')
repl('backend/app/services/piece_version_service.py', r'\'model_stl\',?\s*', '')

repl('backend/app/services/chess_set_service.py', r'\n\s*model_stl=original_version\.model_stl,?', '')

repl('backend/app/api/ai.py', r'\s*\|\s*model_stl', '')
repl('backend/app/api/ai.py', r'else\s*\".stl\"\s*if\s*field\s*==\s*\"model_stl\"\s*', '')

repl('frontend/src/components/EditVersionModal.tsx', r'model_stl\?:\s*File;?', '')
repl('frontend/src/components/EditVersionModal.tsx', r'model_stl:\s*useRef<HTMLInputElement>\(null\),?', '')
repl('frontend/src/components/EditVersionModal.tsx', r'if\s*\(newModels\.model_stl\)\s*data\.model_stl\s*=\s*newModels\.model_stl;', '')
repl('frontend/src/components/EditVersionModal.tsx', r'\{\/\*\s*STL Model\s*\*\/\}[\s\S]*?(?=\{\/\*\s*Bottoni\s*\*\/|\end\{div\}\|\s*<\/form>)', '')
