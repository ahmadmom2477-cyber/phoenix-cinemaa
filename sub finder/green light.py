from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time

# إعدادات المسارات الخاصة بجهازك
chrome_path = "C:/Users/3enawi/OneDrive/Desktop/testhim/chrome-win64/chrome-win64/chrome.exe"
chromedriver_path = "C:/Users/3enawi/OneDrive/Desktop/testhim/chromedriver-win64 (1)/chromedriver-win64/chromedriver.exe"

def get_green_subtitles():
    url = input("🔗 أدخل رابط صفحة الفيلم من Subscene: ")
    
    chrome_options = Options()
    chrome_options.binary_location = chrome_path
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    
    service = Service(chromedriver_path)
    driver = webdriver.Chrome(service=service, options=chrome_options)

    # استخدام set لتخزين الروابط الفريدة فقط ومنع التكرار
    unique_links = set()

    try:
        print("⏳ جاري جلب الترجمات الخضراء الفريدة...")
        driver.get(url)
        time.sleep(4)

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1)

        # البحث عن الأسطر ذات الأيقونة الخضراء (positive-icon)
        rows = driver.find_elements(By.XPATH, "//tr[descendant::span[contains(@class, 'positive-icon')]]")

        print(f"\n✅ تم العثور على ترجمات خضراء. جاري تنقية المكرر...")
        print("="*60)

        for row in rows:
            row_text = row.text.lower()
            if "arabic" in row_text:
                try:
                    link_element = row.find_element(By.TAG_NAME, "a")
                    sub_url = link_element.get_attribute('href')
                    
                    if sub_url:
                        download_url = sub_url.replace("/subtitle/", "/download/")
                        
                        # التحقق إذا كان الرابط موجوداً مسبقاً
                        if download_url not in unique_links:
                            # استخراج اسم النسخة أو المترجم للتوضيح
                            title = row_text.split('\n')[0].replace('arabic', '').strip()
                            print(f"📄 {title}")
                            print(f"🔗 {download_url}")
                            print("-" * 30)
                            
                            # إضافة الرابط للمجموعة لمنع تكراره لاحقاً
                            unique_links.add(download_url)
                except:
                    continue

        if not unique_links:
            print("❌ لم يتم العثور على أي ترجمات خضراء في هذا الرابط.")

    except Exception as e:
        print(f"❌ حدث خطأ: {e}")
    finally:
        driver.quit()
        print(f"\n✨ انتهى البحث. إجمالي الروابط الفريدة: {len(unique_links)}")

if __name__ == "__main__":
    get_green_subtitles()