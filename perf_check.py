import os
import re

def check_files(dir_path):
    issues = []

    for root, _, files in os.walk(dir_path):
        for file in files:
            if not file.endswith('.tsx') and not file.endswith('.ts'):
                continue

            file_path = os.path.join(root, file)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Check for repeated .filter() or .reduce() in a loop/map
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if '.map(' in line:
                    context = '\n'.join(lines[max(0, i):min(len(lines), i+15)])

                    if '.filter(' in context or '.reduce(' in context:
                        # Ensure the filter/reduce is actually inside the map callback
                        if re.search(r'\.map\(.*=>.*\.filter\(', context, re.DOTALL) or \
                           re.search(r'\.map\(.*=>.*\.reduce\(', context, re.DOTALL) or \
                           re.search(r'\.map\(.*{.*\.filter\(', context, re.DOTALL) or \
                           re.search(r'\.map\(.*{.*\.reduce\(', context, re.DOTALL):

                            issues.append(f"{file_path}:{i+1} - Potential O(N*M) with filter/reduce inside map")

    return issues

print("Checking for O(N*M) performance bottlenecks...")
issues = check_files('src/')
for issue in issues:
    print(issue)
