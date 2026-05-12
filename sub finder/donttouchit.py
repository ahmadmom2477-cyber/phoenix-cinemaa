from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time

# إعدادات المسارات (تأكد من صحتها في جهازك)
chrome_path = "C:/Users/3enawi/OneDrive/Desktop/testhim/chrome-win64/chrome-win64/chrome.exe"
chromedriver_path = "C:/Users/3enawi/OneDrive/Desktop/testhim/chromedriver-win64 (1)/chromedriver-win64/chromedriver.exe"

chrome_options = Options()
chrome_options.binary_location = chrome_path
service = Service(chromedriver_path)
driver = webdriver.Chrome(service=service, options=chrome_options)

url = "https://sub-scene.com/subscene/29461"
# قائمة الكلمات المفتاحية المطلوبة
keywords = ["CimaNow", "Netflix", "Amazon Prime", "iTunes", "EgyBest"]

driver.get(url)
time.sleep(5)

# الحصول على جميع الأسطر مرة واحدة لتحليلها
rows = driver.find_elements(By.TAG_NAME, "tr")

print("--- جاري استخراج الروابط حسب الكلمات المفتاحية ---")
print("=" * 50)

for key in keywords:
    print(f"\nالكلمة المفتاحية: [{key}]")
    count = 0  # عداد للنتائج لكل كلمة
    
    for row in rows:
        # التوقف إذا وصلنا لـ 3 نتائج لهذه الكلمة
        if count >= 3:
            break
            
        row_text = row.text
        
        # التحقق من اللغة العربية ووجود الكلمة المفتاحية في السطر
        if "arabic" in row_text.lower() and key.lower() in row_text.lower():
            try:
                link_element = row.find_element(By.TAG_NAME, "a")
                subtitle_url = link_element.get_attribute('href')
                
                if subtitle_url and "/subtitle/" in subtitle_url:
                    download_url = subtitle_url.replace("/subtitle/", "/download/")
                    print(f"  - {download_url}")
                    count += 1
            except:
                continue
    
    if count == 0:
        print("  (لم يتم العثور على نتائج)")

print("\n" + "=" * 50)
print("تم الانتهاء من استخراج جميع الروابط.")

driver.quit()