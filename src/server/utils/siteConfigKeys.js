// サイト内の設定キー定義（画像・テキスト含む）
module.exports = {
    GROUPS: {
        COMMON: '共通設定',
        INDEX: 'トップページ',
        ABOUT: '団について',
        BEAVER: 'ビーバー隊',
        CUB: 'カブ隊',
        BOY: 'ボーイ隊',
        VENTURE: 'ベンチャー隊',
        ROVER: 'ローバー隊',
        JOIN: '入団案内',
        TESTIMONIALS: '保護者の声',
        CONTACT: 'お問い合わせ',
        PRIVACY: 'プライバシーポリシー'
    },
    KEYS: {
        // COMMON
        'site_favicon_url': { group: 'COMMON', type: 'image', label: 'ファビコン' },
        'group_crest_url': { group: 'COMMON', type: 'image', label: '団章（ロゴ）' },

        // INDEX
        'index_hero_image_url': { group: 'INDEX', type: 'image', label: 'ヒーロー画像' },
        'index_highlight_img_1_url': { group: 'INDEX', type: 'image', label: 'ハイライト画像1（楽しさ）' },
        'index_highlight_img_2_url': { group: 'INDEX', type: 'image', label: 'ハイライト画像2（成長）' },
        'index_highlight_img_3_url': { group: 'INDEX', type: 'image', label: 'ハイライト画像3（自然）' },
        'index_testimonial_img_1_url': { group: 'INDEX', type: 'image', label: '保護者の声画像1' },
        'index_testimonial_img_2_url': { group: 'INDEX', type: 'image', label: '保護者の声画像2' },

        // ABOUT
        'about_mission_image_url': { group: 'ABOUT', type: 'image', label: '使命セクション画像' },
        'about_safety_image_url': { group: 'ABOUT', type: 'image', label: '安全への取り組み画像' },

        // JOIN
        'join_hero_image_url': { group: 'JOIN', type: 'image', label: '入団案内トップ画像' },

        // UNITS - LOGOS
        'unit_beaver_logo_url': { group: 'BEAVER', type: 'image', label: 'ビーバー隊章' },
        'unit_cub_logo_url': { group: 'CUB', type: 'image', label: 'カブ隊章' },
        'unit_boy_logo_url': { group: 'BOY', type: 'image', label: 'ボーイ隊章' },
        'unit_venture_logo_url': { group: 'VENTURE', type: 'image', label: 'ベンチャー隊章' },
        'unit_rover_logo_url': { group: 'ROVER', type: 'image', label: 'ローバー隊章' },

        // UNITS - HERO IMAGES
        'unit_beaver_hero_image_url': { group: 'BEAVER', type: 'image', label: 'ビーバー隊活動イメージ' },
        'unit_cub_hero_image_url': { group: 'CUB', type: 'image', label: 'カブ隊活動イメージ' },
        'unit_boy_hero_image_url': { group: 'BOY', type: 'image', label: 'ボーイ隊活動イメージ' },
        'unit_venture_hero_image_url': { group: 'VENTURE', type: 'image', label: 'ベンチャー隊活動イメージ' },
        'unit_rover_hero_image_url': { group: 'ROVER', type: 'image', label: 'ローバー隊活動イメージ' },

        // UNITS - GALLERY
        'unit_beaver_gallery_img_1_url': { group: 'BEAVER', type: 'image', label: 'ギャラリー画像1' },
        'unit_beaver_gallery_img_2_url': { group: 'BEAVER', type: 'image', label: 'ギャラリー画像2' },
        'unit_beaver_gallery_img_3_url': { group: 'BEAVER', type: 'image', label: 'ギャラリー画像3' },
        'unit_beaver_gallery_img_4_url': { group: 'BEAVER', type: 'image', label: 'ギャラリー画像4' },

        'unit_cub_gallery_img_1_url': { group: 'CUB', type: 'image', label: 'ギャラリー画像1' },
        'unit_cub_gallery_img_2_url': { group: 'CUB', type: 'image', label: 'ギャラリー画像2' },
        'unit_cub_gallery_img_3_url': { group: 'CUB', type: 'image', label: 'ギャラリー画像3' },
        'unit_cub_gallery_img_4_url': { group: 'CUB', type: 'image', label: 'ギャラリー画像4' },

        'unit_boy_gallery_img_1_url': { group: 'BOY', type: 'image', label: 'ギャラリー画像1' },
        'unit_boy_gallery_img_2_url': { group: 'BOY', type: 'image', label: 'ギャラリー画像2' },
        'unit_boy_gallery_img_3_url': { group: 'BOY', type: 'image', label: 'ギャラリー画像3' },
        'unit_boy_gallery_img_4_url': { group: 'BOY', type: 'image', label: 'ギャラリー画像4' },

        'unit_venture_gallery_img_1_url': { group: 'VENTURE', type: 'image', label: 'ギャラリー画像1' },
        'unit_venture_gallery_img_2_url': { group: 'VENTURE', type: 'image', label: 'ギャラリー画像2' },
        'unit_venture_gallery_img_3_url': { group: 'VENTURE', type: 'image', label: 'ギャラリー画像3' },
        'unit_venture_gallery_img_4_url': { group: 'VENTURE', type: 'image', label: 'ギャラリー画像4' },

        'unit_rover_gallery_img_1_url': { group: 'ROVER', type: 'image', label: 'ギャラリー画像1' },
        'unit_rover_gallery_img_2_url': { group: 'ROVER', type: 'image', label: 'ギャラリー画像2' },
        'unit_rover_gallery_img_3_url': { group: 'ROVER', type: 'image', label: 'ギャラリー画像3' },
        'unit_rover_gallery_img_4_url': { group: 'ROVER', type: 'image', label: 'ギャラリー画像4' },

        // LEADERS - PHOTOS & MESSAGES
        'unit_beaver_leader_photo_url': { group: 'BEAVER', type: 'image', label: 'リーダー顔写真' },
        'unit_cub_leader_photo_url': { group: 'CUB', type: 'image', label: 'リーダー顔写真' },
        'unit_boy_leader_photo_url': { group: 'BOY', type: 'image', label: 'リーダー顔写真' },
        'unit_venture_leader_photo_url': { group: 'VENTURE', type: 'image', label: 'リーダー顔写真' },
        'unit_rover_leader_photo_url': { group: 'ROVER', type: 'image', label: 'アドバイザー顔写真' },

        'unit_beaver_leader_message': { group: 'BEAVER', type: 'text', label: 'リーダーメッセージ' },
        'unit_cub_leader_message': { group: 'CUB', type: 'text', label: 'リーダーメッセージ' },
        'unit_boy_leader_message': { group: 'BOY', type: 'text', label: 'リーダーメッセージ' },
        'unit_venture_leader_message': { group: 'VENTURE', type: 'text', label: 'リーダーメッセージ' },
        'unit_rover_leader_message': { group: 'ROVER', type: 'text', label: 'リーダーメッセージ' },

        // TESTIMONIALS PAGE
        'testimonial_page_img_1_url': { group: 'TESTIMONIALS', type: 'image', label: '写真1（佐藤様・橙）' },
        'testimonial_page_img_2_url': { group: 'TESTIMONIALS', type: 'image', label: '写真2（鈴木くん・青）' },
        'testimonial_page_img_3_url': { group: 'TESTIMONIALS', type: 'image', label: '写真3（鈴木様・緑）' },
        'testimonial_page_img_4_url': { group: 'TESTIMONIALS', type: 'image', label: '写真4（高橋さん・紫）' },

        // CONTACT INFO (EXISTING)
        'contact_address': { group: 'CONTACT', type: 'text', label: '住所' },
        'contact_phone': { group: 'CONTACT', type: 'text', label: '代表電話番号' },
        'contact_email': { group: 'CONTACT', type: 'text', label: 'メールアドレス' },
        'contact_person_name': { group: 'CONTACT', type: 'text', label: '担当者名' },
        'contact_secondary_phone': { group: 'CONTACT', type: 'text', label: '問い合わせ用電話番号（担当者直通など）' },
        'contact_map_embed_html': { group: 'CONTACT', type: 'textarea', label: 'Google Maps埋め込みHTML（iframeタグ）' },

        // LEADERS（各隊リーダー名）
        'leader_beaver': { group: 'BEAVER', type: 'text', label: 'ビーバー隊隊長名' },
        'leader_cub': { group: 'CUB', type: 'text', label: 'カブ隊隊長名' },
        'leader_boy': { group: 'BOY', type: 'text', label: '隊長名' },
        'leader_venture': { group: 'VENTURE', type: 'text', label: '隊長名' },
        'leader_rover': { group: 'ROVER', type: 'text', label: 'ローバー隊隊長名' },

        // PRIVACY
        'privacy_contact_person': { group: 'PRIVACY', type: 'text', label: '個人情報担当者' },
        'privacy_contact_phone': { group: 'PRIVACY', type: 'text', label: '担当電話番号' },
        'privacy_contact_email': { group: 'PRIVACY', type: 'text', label: '担当メールアドレス' },
        'privacy_effective_date': { group: 'PRIVACY', type: 'date', label: '施行日' },
        'privacy_last_updated_date': { group: 'PRIVACY', type: 'date', label: '最終更新日' },
    }
};
