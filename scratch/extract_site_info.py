import urllib.request
import re

url = 'https://metalfisa.com.br/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    
    print("--- IMAGES ---")
    imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html)
    for img in set(imgs):
        print(img)
        
    print("\n--- BACKGROUND IMAGES ---")
    bgs = re.findall(r'background-image:\s*url\([\'"]?([^\'")]+)[\'"]?\)', html)
    for bg in set(bgs):
        print(bg)
        
    print("\n--- STYLES / COLORS ---")
    # find inline styles or internal styles for colors
    colors = re.findall(r'color:\s*(#[0-9a-fA-F]{3,6})', html)
    bg_colors = re.findall(r'background(?:-color)?:\s*(#[0-9a-fA-F]{3,6})', html)
    
    from collections import Counter
    print("Colors:")
    for c, count in Counter(colors).most_common(5):
        print(f"{c}: {count}")
    print("Bg Colors:")
    for c, count in Counter(bg_colors).most_common(5):
        print(f"{c}: {count}")
        
    # Let's also check for external CSS links to extract their colors
    css_links = re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']', html)
    for css in css_links:
        if css.startswith('/'):
            css = 'https://metalfisa.com.br' + css
        elif not css.startswith('http'):
            continue
            
        print(f"Fetching CSS: {css}")
        try:
            css_content = urllib.request.urlopen(urllib.request.Request(css, headers={'User-Agent': 'Mozilla/5.0'})).read().decode('utf-8')
            all_colors = re.findall(r'(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b', css_content)
            print("Top Colors in CSS:")
            for c, count in Counter(all_colors).most_common(5):
                print(f"{c}: {count}")
        except Exception as e:
            print(f"Failed to fetch {css}: {e}")

except Exception as e:
    print(e)
