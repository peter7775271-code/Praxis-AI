import argparse
import json
import os
from typing import Any

import requests


API_URL = "https://www.woolworths.com.au/apis/ui/browse/category"
COOKIE_OVERRIDE = "ai_user=bsRWft8EpE3wuaiGBMH551|2025-09-30T13:15:51.477Z; utag_main_v_id=01999ac3f5f3004bc623946e74440506f034c06700838; utag_main_vapi_domain=woolworths.com.au; sf-locationName=Woolworths North Strathfield, 2137; sf-locationId=4787; sf-postcode=2137; INGRESSCOOKIE=1773497009.059.59.90786|37206e05370eb151ee9f1b6a1c80a538; w-rctx=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NzM0OTcwMDgsImV4cCI6MTc3MzUwMDYwOCwiaWF0IjoxNzczNDk3MDA4LCJpc3MiOiJXb29sd29ydGhzIiwiYXVkIjoid3d3Lndvb2x3b3J0aHMuY29tLmF1Iiwic2lkIjoiMCIsInVpZCI6IjMzOWFjM2NjLTk2OTctNDNjZS1iYTMzLTY1YWY2YjIxZDllZCIsIm1haWQiOiIwIiwiYXV0IjoiU2hvcHBlciIsImF1YiI6IjAiLCJhdWJhIjoiMCIsIm1mYSI6IjEifQ.dDCoV0AoVIFgTGy9-yJ2aeQTYN5AhnzWp2c7tgFY0mt0ZPdF_M-NXAU8RJpgciEfe0dTNMMJTnsoeM4jZlVhBI1vCZYAyIiRa3WLQTpUCMsuGD8m6JE0Zjg3mYdTdPIgnT6uJUtzgG47y1aWor_w1uv2_OhIRym38w4tj56AEwG4Tlzk4Gxf1piDc-uh432ePqZREFsbMmNUZg3OQDthrLE__tpWjGGv1Z3GEfhw1CDguI8MaKFCm9d07AdLxPRslHcN8tx2n7IdzXJUXAaDppM7aXORmeCCyE1Zjx6XRP3dPcgTYFloHzL5Rr-WlchcpwMdVw9wa0ido7UbaFLaZg; wow-auth-token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NzM0OTcwMDgsImV4cCI6MTc3MzUwMDYwOCwiaWF0IjoxNzczNDk3MDA4LCJpc3MiOiJXb29sd29ydGhzIiwiYXVkIjoid3d3Lndvb2x3b3J0aHMuY29tLmF1Iiwic2lkIjoiMCIsInVpZCI6IjMzOWFjM2NjLTk2OTctNDNjZS1iYTMzLTY1YWY2YjIxZDllZCIsIm1haWQiOiIwIiwiYXV0IjoiU2hvcHBlciIsImF1YiI6IjAiLCJhdWJhIjoiMCIsIm1mYSI6IjEifQ.dDCoV0AoVIFgTGy9-yJ2aeQTYN5AhnzWp2c7tgFY0mt0ZPdF_M-NXAU8RJpgciEfe0dTNMMJTnsoeM4jZlVhBI1vCZYAyIiRa3WLQTpUCMsuGD8m6JE0Zjg3mYdTdPIgnT6uJUtzgG47y1aWor_w1uv2_OhIRym38w4tj56AEwG4Tlzk4Gxf1piDc-uh432ePqZREFsbMmNUZg3OQDthrLE__tpWjGGv1Z3GEfhw1CDguI8MaKFCm9d07AdLxPRslHcN8tx2n7IdzXJUXAaDppM7aXORmeCCyE1Zjx6XRP3dPcgTYFloHzL5Rr-WlchcpwMdVw9wa0ido7UbaFLaZg; prodwow-auth-token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYmYiOjE3NzM0OTcwMDgsImV4cCI6MTc3MzUwMDYwOCwiaWF0IjoxNzczNDk3MDA4LCJpc3MiOiJXb29sd29ydGhzIiwiYXVkIjoid3d3Lndvb2x3b3J0aHMuY29tLmF1Iiwic2lkIjoiMCIsInVpZCI6IjMzOWFjM2NjLTk2OTctNDNjZS1iYTMzLTY1YWY2YjIxZDllZCIsIm1haWQiOiIwIiwiYXV0IjoiU2hvcHBlciIsImF1YiI6IjAiLCJhdWJhIjoiMCIsIm1mYSI6IjEifQ.dDCoV0AoVIFgTGy9-yJ2aeQTYN5AhnzWp2c7tgFY0mt0ZPdF_M-NXAU8RJpgciEfe0dTNMMJTnsoeM4jZlVhBI1vCZYAyIiRa3WLQTpUCMsuGD8m6JE0Zjg3mYdTdPIgnT6uJUtzgG47y1aWor_w1uv2_OhIRym38w4tj56AEwG4Tlzk4Gxf1piDc-uh432ePqZREFsbMmNUZg3OQDthrLE__tpWjGGv1Z3GEfhw1CDguI8MaKFCm9d07AdLxPRslHcN8tx2n7IdzXJUXAaDppM7aXORmeCCyE1Zjx6XRP3dPcgTYFloHzL5Rr-WlchcpwMdVw9wa0ido7UbaFLaZg; dtCookie=v_4_srv_5_sn_B210FD657BC92E006A15BB0A822FD39E_perc_100000_ol_0_mul_1_app-3Af908d76079915f06_0_rcs-3Acss_0; AKA_A2=A; bm_ss=ab8e18ef4e; bff_region=syd2; at_check=true; AMCVS_4353388057AC8D357F000101%40AdobeOrg=1; akaalb_woolworths.com.au=~op=www_woolworths_com_au_ZoneA:PROD-ZoneA|www_woolworths_com_au_BFF_SYD_Launch:WOW-BFF-SYD2|www_woolworths_com_au_ZoneAandC:PROD-ZoneC|~rv=73~m=PROD-ZoneA:0|WOW-BFF-SYD2:0|PROD-ZoneC:0|~os=43eb3391333cc20efbd7f812851447e6~id=5026ce6f144fbd8f366eda5b26c86869; bm_lso=C50C3E245F9A45063F576FC7720D04A5A1AB8F04651EA17E6077B050E19ED555~YAAQHR42F+yd7uScAQAAJDup7Acuj08FPkti2/xwJXK5uZbNW9TOxFYRXNsi+fkEFKUrIiUjVA9M8SCqIJrD7gaIKW7JY5wijIYmrBRv1fmbqX3H3TVP9KEyTzz9LeFKNNzNUSYv7vjLy6Acgj9HftPSrZXKkZ+PVpr77Z1SDii8fdsMSFfPj9uC/9qKl33Dm2BgvwLcpQZCPHDVzb6ctATZ3+io4AaqrRguFPjt28lJmFA3QldwJiSEuAbeZZLdIgJZR004M051651ASnUNiOn62Ur/J4qsptjkHn9Nh/xTtexBW+CBJf3SLELlUjiwG1a8dmklzXghwwrq48zIhe4jbZ/bguVDU2xnZhT5G9+pSAXFYMlLqNTPtwH6hNwLn0ZEBRjM2tW1/EKPDxPNsWgPpoWFly9rcHs/Rowl4okj9jZC/pJutWo7ZoUgnecxsVpU11GTu5PjHAXQa/VQPRMwFrnF3/0=~1773497040303; utag_main__sn=4; utag_main_ses_id=1773497044035%3Bexp-session; fullstoryEnabled=false; utag_main_dc_visit=4; s_cc=true; utag_main__ss=0%3Bexp-session; bm_mi=FB5C6C2408537473BB8E0EC0E2D78CC0~YAAQHR42F5Cq7uScAQAAy8Gq7B/llNCW3CDPzrW0m8+gGZomXlsAok2Udy7PaGT+s2oVHUjz92GQvRJiX9Sz7izzVCQgUBud6v0LwVkS2p3WmzG4VKNmrRXt6TwOFCch3XXbI5ZExSmMf+ZagtOJ42QZowSExCg3cRISpMj8h8iyL/Uegr6YzhhUdRoKgWMNX75HsGlKXO/Q10yBqzsDzcT5GJuf2SZHMODInmg/SEPxjKD94ZEqdEpkxfp3fLMUH35SqzicN5QJ7+Ke2syqQIOe5+jNHo8kv1dHNZKGdwP7GmRoyOgpO2LHWYrBNfcYZSfbY+54MpQwXAOYxP7ePjW0K2DmTrqZ8y7RFlpJioHdwy0fSmSj5wN4~1; bm_sv=D19DFB2D484B4E9844E4082B90B35773~YAAQHR42F8aq7uScAQAA7Maq7B/8A3NRPDd57a80Cg+Xd0cAhGDShbNcFXjK41hp9rPraXoP5xLMIr3+0D+4SihBCy28Xe5quGORkcZivzNRbeulkhZHbAsmxpgMJFo6TMd0sllUiEjct+2/ss418+rX+h/tA5q0SL1RmJ27VzKC0QpWIFT3N+tOMo7WdgaImPtkXH+uPhOvzlE6CoepggbngKxtIRrp4ytqjynLwKG2gHT96hpn37XvGZsjtVrqZ0bdi7dyTQs=~1; ak_bmsc=1E12D6276F12F41B6B1E1C8A5ECEEF07~000000000000000000000000000000~YAAQHR42F3Kt7uScAQAA0BWr7B+pvdUGDoGClLFv6iVEkJb/MKBhydkb/J9gvwd5JrqpV63Q9VttnxhKQaW2u7ijPynm5YLzNHNbNNnlPqaTwVyU8GXUuv5fAaMFKh1eJszNyKpDjhauTjdFU9OhkEetMU4uJ9zpgs/nzsjqZ4/ilXXTZqAywpB0l7kfNNHHl2NhbVqPzUSPyrfgg5Q5XpkeLE526xlBg+NPbRO7SODRQKF7IK18KQGvR/TFH8PwVA3CHF6w873LMmYHVaqPcRkk7/UlwUQTCgNrvz6e4pU9u3f5EmNwo7j278ht3ZjU1kQbdGVFDgiJk3jCP/0uT1lsQjq/eDbk6pQwvJxHB98Urh6Dp86w6o3JRcCj0UL5Xik5iPIRrW1F+10Kxm/Ww/7AxIWUNo8A4KfUT/aMGEY2UwkZNmZOCIcJKRWUYZojkCNxUhtTleJitCbbYWq0FYXFNQWnAbot3GO121XoAg==; utag_main_dc_event=6%3Bexp-session; bm_so=6B80FD3DC0FE382196559AE4B91E0140814A4E41199AB591091A285FB49CD299~YAAQHR42F4Ag7+ScAQAAlGu47AfevqQo+wlyPc1QoR5mmVhS1+zm/vMaqHjQamVnJkyJx+BRYRb7PMt9+YBt1qhmr26sMPSUijffeMqglObdY0PLpNix4J65lCVUfIOOfBS5sHmvYou88dPETLwmgF+0r3lZ6db50sBAp2gBp8fUHpP1tfDlpSpIJmG+uUuV9PL/IFeqkLmfSuUSDCjkcggP+eVznX8jb43MRxtyr0PS734fd3IP3yu7hobuwWWZq4OgEf62dO3DVwa8U6E52GGvwXFxVD0eAAIoBg3W14hkRKxAfvTvESqC1yV1e1hDf6tBs90fXMaMstC4DlVK7fMQ36dHxoTXvOEKqmtfl3Q9eZ6BhLCZelGRkeGe44/lFMVkaaxk6sId3E046RHt5lH7z+IOz79X3edV4wpJrMPZ4SdIUjrQte9XhahlIjH8Rnt5dmdWbfQhByxHWV3tqyK9rEfMGmE=; bm_sz=5B1D72C03C33E9ED4A8F83F2196B352D~YAAQHR42F4Eg7+ScAQAAlGu47B8B/cODc8brcHmFLxVLXewyMvTwVK9QJ7QyzRH6H9bzPtmiLussoaDScPaFGZQDU8hg7Xt0548L8I+E5fs/eZ72Dd+eqX3FejoIBMjC1NKkFS+Ba4d+Q9X7oNV+9clweIT49jmgbdeZkfeA/gX/9pvG24XZD+nIIR3QA4iMs5u54/gCeeFFLnrgDdjrPI+rajSB7v82Lk3GiOcTF+1HHO5cTZa477OyIvT9H/GWxusWVJSzjozLDh1IJm0mxDONEE0Tm7Bdniaf/IZzthQo6jw3K9xvorw2Ilu4yBubw0HqxGyqFbjEDqvZdH1OEa+sKMJyMbsSxt+L1OJgjXbm2TnCAmZKAmRcLPf4dNtTSEodyYi1eBEeK0A8HsD0QwTqZXUGJ7c8rEon8MQPB5jP/nVPE0BDjY8Sex5cIqpYPDVxWWJGYwBzOFBns9aSJV5tvfskE1weMdmsXZPpRDWJcGY=~3224645~3687747; _abck=B6CDC5C6BF2DE76E43FBDC5DE8143400~0~YAAQHR42F6Ag7+ScAQAAP2y47A+CwCIcrPSGXdUWx3sK0J7xQuibOcgeDEXEZKfC5lLocTED4AaIxiNMqKeKDAI3JzTUeGeMXO2cdYe0blczEIrlYs8iya/nhCBsD3fh9l+uxEKgdbSukPrr2JcTCeNGaCG7iHT7AE7DCe52Khu3Vdiqcy4Sp/Pms7aBQ5g/hyR8lDx9JkBD7/J7KVkTIRWBOuepZTYl3zvxo1P9S8uNhUQOi8swalrWizVUmq3nT1IbQOypsQe0+KE3VyYDgbTqLe7V3NBta/R1D8ZiwChlVRLRb58mHL31GzsZ+wDDU4He+Qf+VHUgCqO0VrrLoRIzNY+LJ8oMfirA7zPfOZWga2ElkQT8Wc4uciyuyWw/02ngdTjLQQNYNDJcnznwvM+Sr2AzejTYnNAoy47WZ/TTybetK6u+MSg5z6wvlhxaGCcM9O93XxAo7NigVXqW/9839MvnYgZCJiUsOFDobfUT+pgZjqlNeJg3GURcdsXfKWoubSqHRVGOG2mApIV/8VLXn3kOsyg+npDfquuPIskeLORKHlW6AyXvOnWe13FyZSCapfEXaYOSnnWdteiIIvzKdXyiwtvUVTIfpDRBZHQefRB5JGvzbPGLfJt9uUG8h2mcj5eNyPwhVL7/u7XIZpqlql+AJ6cdkIMwVWffw3CvVfKlQC8HgsKNvRQWph+ikdDRIEhzX8yy5TB3qj/LLfah+saIxAsiLk3PoJcL02FpUezuDB/c16Tun4V+QTuXogY2sCZzrBMn4ieyHtJB8MFJk9ZFUjOMMYO/zhwYwcmsU0tKoWOT+pSm05cldYw2gHWcLuQhWlPzv6yMbRdLA2y6WTTJ8WDpJMzAq13L8QfEK35zjpYa4lmq/+8=~-1~-1~1773500640~AAQAAAAF%2f%2f%2f%2f%2f++Cs1ovRsMikQ6zhMvAoCphAhmBh91RaOG6l9pN9+cAivqBhbaj251c6vzKJSUCwkb81tjzoSCHEm4p5LzIV%2fUX%2f6n1lhfZ8REdMlkCVUJxinST9cweaCvmv0Q5Awm2dRT%2f06kpH3LiMrzOuFdeAOdHlQajrhrJHs3zGBCMLg%3d%3d~-1; AMCV_4353388057AC8D357F000101%40AdobeOrg=179643557%7CMCIDTS%7C20527%7CMCMID%7C01535114609029030702219037247263384268%7CMCOPTOUT-1773505235s%7CNONE%7CvVersion%7C5.5.0; bm_s=YAAQHR42F7Mg7+ScAQAAqm247AVdcZkqYcoPEV/kmEyy9Junb59UbMMB8vAUGvy0/btalZ0jcmx0uLfa2OGGKVpbBHHKLAeNZsh0bML7mqpzUD0Fy44xBpNWEpwD0s6h08o87pzAIS5yoqsAd/8b1d/pCxGXW4wDiJiAYLyiH3xx3bVcIe454OQ9z0oeFmPafRQoBtiimgk95YG472t0xfvVi8hVYrsYH6dPUkv55fO9H1qD0UzpZGATj9HJvjedhtdBkyKvHOatzl7TYB9kOW0o8wfkCfxgf6ixyglg7rlisKZGKZABGwtnDN0Xy3Ea6WEDjFDcILqnY/nAOS1/Skti4BpjPz2EIaSSCkYpS95SP9A23EKkbqRRYU9DTSblOpAKh80mGmyH1QdFSvvbRywEi15caynOktAnC7Eanjxx6lDlQuef1DnW8uh3Wn2uM0S6AgeqmUDUiTAOOJICDnWl8n8gWMtO+Wp2T+8IWPAyOYlUjx/BttPKiwAVyl94W7v7MgcYbULtzFQ0Ow6IljYJ/8IzXuqjCQxrdsAwJYqdy8pCY6UAno6qPEJ+YE3BJ8zZyjl2ZlpFCs0Wut8kzUmO3Mtksu+NCeRhxlyQNgUu4fJKmYK95kP0Es72LPoW7qO2GQvDi2SbWQA5kmOVOGfF5k7NFb5Zaha/9+kX9QOjSiY4vD2CF0JJubXRqIQZFlcsJXGox4RRhV+o/60nldRnIh1gemuQ58U/KB6sJuI8PVIUZhKDAQmgrT34UdL36B+00A3oIWEzR2Pts/VWcGv6HDVsj8HW5f7/4ci25dP88CHhjqBUnNyrLjOyJQVJZaXy2+On4pxIw4oIFBIJve6IGnXkPYOO24H4KmTXG5PE1FM4X4sItXfnw1WiBZxPOP1ejDD3bbLSBhhlto+Vn8fO9WJ77ifzYkOnAlBiCWC6RUdIJAOE+2VO31fGnNGIXuVoIV2HO8kX2BGGcDDzhkY=; ai_session=D3HmufKVdwwoza1fHMGvNd|1773497039745|1773498036889; utag_main__pn=2%3Bexp-session; utag_main__se=15%3Bexp-session; utag_main__st=1773499836935%3Bexp-session; mbox=PC#d204c757344040ec81d12d60e94f0e07.36_0#1836741842|session#789b493f34824e33a336f59e8fa606eb#1773499898"

def build_headers(cookie: str) -> dict[str, str]:
    return {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json",
        "origin": "https://www.woolworths.com.au",
        "referer": "https://www.woolworths.com.au/shop/browse/fruit-veg/fruit",
        "user-agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/145.0.0.0 Safari/537.36"
        ),
        "cookie": cookie,
    }


def build_payload(page_number: int, page_size: int) -> dict[str, Any]:
    return {
        "categoryId": "1_E5BEE36E",
        "pageNumber": page_number,
        "pageSize": page_size,
        "sortType": "TraderRelevance",
        "url": "/shop/browse/fruit-veg/fruit",
        "location": "/shop/browse/fruit-veg/fruit",
        "formatObject": json.dumps({"name": "Fruit"}),
        "enableLoyalties": False,
        "enableTagFilter": False,
        "filters": [],
    }


def extract_products(data: dict[str, Any]) -> list[tuple[str, Any]]:
    output: list[tuple[str, Any]] = []
    for bundle in data.get("Bundles", []):
        products = bundle.get("Products", [])
        if not products:
            continue
        product = products[0]
        output.append((product.get("Name", "<unknown>"), product.get("Price")))
    return output


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch Woolworths fruit category products and prices."
    )
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1)")
    parser.add_argument("--size", type=int, default=36, help="Page size (default: 36)")
    args = parser.parse_args()

    cookie = COOKIE_OVERRIDE.strip() or os.getenv("WOOLIES_COOKIE", "").strip()
    if not cookie:
        print("Error: set COOKIE_OVERRIDE in this file or WOOLIES_COOKIE env var.")
        print(
            "Example COOKIE_OVERRIDE: 'cookie1=value1; cookie2=value2; ...'"
        )
        print(
            "Example env var: export WOOLIES_COOKIE='cookie1=value1; cookie2=value2; ...'"
        )
        return 1

    response = requests.post(
        API_URL,
        headers=build_headers(cookie),
        json=build_payload(page_number=args.page, page_size=args.size),
        timeout=30,
    )

    if response.status_code != 200:
        print(f"HTTP {response.status_code}")
        print(response.text[:1000])
        return 1

    try:
        data = response.json()
    except requests.JSONDecodeError:
        print("Error: response was not valid JSON")
        print(response.text[:1000])
        return 1

    products = extract_products(data)
    if not products:
        print("No products found. Cookie/session may be invalid.")
        return 1

    for name, price in products:
        print(f"{name} - {price}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())