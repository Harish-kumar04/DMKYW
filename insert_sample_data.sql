-- =====================================================================
-- DMK YouthWing: Sample data insert
-- Run this in Supabase SQL Editor
-- =====================================================================

-- ---------- 1. Members (from the attached list) ----------
DO $$
DECLARE v_id uuid; v_mid text;
BEGIN

  -- Helper: insert a member and get their member ID
  -- Udhayanithi Stalin - Chepauk, Chennai
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Udhayanithi Stalin', 'Chennai', '9000000001',
          encode(hmac('DUMMY0000001', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0001')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000001', 'Udhayanithi', 'Chennai');
  END IF;

  -- Senthil - Tenampet, Chennai
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Senthil', 'Chennai', '9000000002',
          encode(hmac('DUMMY0000002', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0002')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000002', 'Senthil', 'Chennai');
  END IF;

  -- Chatrian
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Chatrian', 'Chennai', '9000000003',
          encode(hmac('DUMMY0000003', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0003')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000003', 'Chatrian', 'Chennai');
  END IF;

  -- Sharavs
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Sharavs', 'Chennai', '9000000004',
          encode(hmac('DUMMY0000004', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0004')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000004', 'Sharavs', 'Chennai');
  END IF;

  -- Gowtham
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Gowtham', 'Coimbatore', '9000000005',
          encode(hmac('DUMMY0000005', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0005')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000005', 'Gowtham', 'Coimbatore');
  END IF;

  -- Panner Perumal
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Panner Perumal', 'Madurai', '9000000006',
          encode(hmac('DUMMY0000006', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0006')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000006', 'Panner', 'Madurai');
  END IF;

  -- Harishkumar - Salem West, Salem
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Harishkumar', 'Salem', '9000000007',
          encode(hmac('DUMMY0000007', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0007')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000007', 'Harishkumar', 'Salem');
  END IF;

  -- Kathir RS - Chrompet, Chennai
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Kathir RS', 'Chennai', '9000000008',
          encode(hmac('DUMMY0000008', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0008')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000008', 'Kathir', 'Chennai');
  END IF;

  -- Nandha kumar - Kolathur, Chennai
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Nandha kumar', 'Chennai', '9000000009',
          encode(hmac('DUMMY0000009', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0009')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000009', 'Nandha', 'Chennai');
  END IF;

  -- Rajesh - Tambaram, Chennai
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Rajesh', 'Chennai', '9000000010',
          encode(hmac('DUMMY0000010', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0010')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000010', 'Rajesh', 'Chennai');
  END IF;

  -- Tharik - Perambur, Chennai
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Tharik', 'Chennai', '9000000011',
          encode(hmac('DUMMY0000011', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0011')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000011', 'Tharik', 'Chennai');
  END IF;

  -- Kathimani - Kanchipuram
  v_id := NULL;
  INSERT INTO public.yw_members (name, district, contact, voter_hash, voter_last4)
  VALUES ('Kathimani', 'Kanchipuram', '9000000012',
          encode(hmac('DUMMY0000012', (SELECT value FROM yw_private WHERE key='pepper'), 'sha256'), 'hex'), '0012')
  ON CONFLICT (voter_hash) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO public.yw_member_ids (member_ref, contact, first_name, district)
    VALUES (v_id, '9000000012', 'Kathimani', 'Kanchipuram');
  END IF;

END $$;

-- ---------- 2. Feeds (published, visible on public site) ----------
DO $$
DECLARE v_feed uuid; v_mid text;
BEGIN

  -- Feed 1
  INSERT INTO public.yw_feeds (title, description, district, activity_type_id, activity_date, consent, status)
  VALUES (
    'இரத்த தான முகாம் – சென்னை',
    'சென்னை மாவட்ட திமுக இளைஞரணி உறுப்பினர்கள் அரசு மருத்துவமனையில் இரத்த தான முகாம் நடத்தினர். 75 பேர் இரத்தம் தானம் செய்தனர்.',
    'Chennai', 2, CURRENT_DATE - 3, true, 'published'
  ) ON CONFLICT DO NOTHING RETURNING id INTO v_feed;

  IF v_feed IS NOT NULL THEN
    SELECT member_id INTO v_mid FROM public.yw_member_ids WHERE first_name = 'Udhayanithi' LIMIT 1;
    IF v_mid IS NOT NULL THEN
      INSERT INTO public.yw_feed_credits (feed_id, member_id, points, credit_date)
      VALUES (v_feed, v_mid, 5, CURRENT_DATE - 3) ON CONFLICT DO NOTHING;
    END IF;
    SELECT member_id INTO v_mid FROM public.yw_member_ids WHERE first_name = 'Senthil' LIMIT 1;
    IF v_mid IS NOT NULL THEN
      INSERT INTO public.yw_feed_credits (feed_id, member_id, points, credit_date)
      VALUES (v_feed, v_mid, 5, CURRENT_DATE - 3) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Feed 2
  v_feed := NULL;
  INSERT INTO public.yw_feeds (title, description, district, activity_type_id, activity_date, consent, status)
  VALUES (
    'நூல் தானம் – சேலம்',
    'சேலம் மாவட்டத்தில் 200-க்கும் மேற்பட்ட புத்தகங்களை பள்ளி நூலகங்களுக்கு வழங்கினோம். மாணவர்கள் மிகுந்த மகிழ்ச்சியுடன் ஏற்றுக்கொண்டனர்.',
    'Salem', 4, CURRENT_DATE - 7, true, 'published'
  ) ON CONFLICT DO NOTHING RETURNING id INTO v_feed;

  IF v_feed IS NOT NULL THEN
    SELECT member_id INTO v_mid FROM public.yw_member_ids WHERE first_name = 'Harishkumar' LIMIT 1;
    IF v_mid IS NOT NULL THEN
      INSERT INTO public.yw_feed_credits (feed_id, member_id, points, credit_date)
      VALUES (v_feed, v_mid, 5, CURRENT_DATE - 7) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Feed 3
  v_feed := NULL;
  INSERT INTO public.yw_feeds (title, description, district, activity_type_id, activity_date, consent, status)
  VALUES (
    'இலவச சேவை முகாம் – கோவை',
    'கோவை மாவட்டத்தில் சான்றிதழ், ஓய்வூதியம் மற்றும் திட்ட விண்ணப்பங்களுக்கு இலவச உதவி வழங்கினோம். 120-க்கும் மேற்பட்டோர் பயன் பெற்றனர்.',
    'Coimbatore', 5, CURRENT_DATE - 10, true, 'published'
  ) ON CONFLICT DO NOTHING RETURNING id INTO v_feed;

  IF v_feed IS NOT NULL THEN
    SELECT member_id INTO v_mid FROM public.yw_member_ids WHERE first_name = 'Gowtham' LIMIT 1;
    IF v_mid IS NOT NULL THEN
      INSERT INTO public.yw_feed_credits (feed_id, member_id, points, credit_date)
      VALUES (v_feed, v_mid, 5, CURRENT_DATE - 10) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Feed 4
  v_feed := NULL;
  INSERT INTO public.yw_feeds (title, description, district, activity_type_id, activity_date, consent, status)
  VALUES (
    'மாணவர்களுக்கு நோட்டுப் புத்தக தானம் – கஞ்சிப்புரம்',
    'கஞ்சிப்புரம் மாவட்ட அரசு பள்ளி மாணவர்களுக்கு 500 நோட்டுப் புத்தகங்கள் மற்றும் 100 கதைப் புத்தகங்கள் வழங்கப்பட்டன.',
    'Kanchipuram', 3, CURRENT_DATE - 14, true, 'published'
  ) ON CONFLICT DO NOTHING RETURNING id INTO v_feed;

  IF v_feed IS NOT NULL THEN
    SELECT member_id INTO v_mid FROM public.yw_member_ids WHERE first_name = 'Kathimani' LIMIT 1;
    IF v_mid IS NOT NULL THEN
      INSERT INTO public.yw_feed_credits (feed_id, member_id, points, credit_date)
      VALUES (v_feed, v_mid, 3, CURRENT_DATE - 14) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

END $$;

-- ---------- 3. Podcast episodes ----------
INSERT INTO public.yw_podcast_episodes (category, title, speaker, ep_date, youtube, published) VALUES
('general', 'திமுக இளைஞரணியின் புதிய பார்வை – உதயநிதி ஸ்டாலின்', 'உதயநிதி ஸ்டாலின்', CURRENT_DATE - 5,
 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true),
('general', 'இளைஞர்களுக்கான வேலைவாய்ப்பு திட்டங்கள் – விவாதம்', 'முனைவர். செந்தில்', CURRENT_DATE - 12,
 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true),
('book', 'அண்ணாவின் சிந்தனைகள் – நூல் அலசல்', 'பேரா. கார்த்திக்', CURRENT_DATE - 20,
 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true),
('general', 'சமூக நீதியும் கல்வியும் – இளைஞர் கண்ணோட்டம்', 'அட்வகேட் தாரிக்', CURRENT_DATE - 28,
 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true)
ON CONFLICT DO NOTHING;

-- ---------- 4. Books ----------
INSERT INTO public.yw_books (title, author, why, level, category, published) VALUES
('நெஞ்சுக்கு நீதி', 'கலைஞர் மு. கருணாநிதி', 'திமுக வரலாற்றை அறிய வேண்டிய அடிப்படை நூல்.', 'Beginner', 'History', true),
('Dravidian Movement: A Historical Study', 'M. Venkatarangaiya', 'The best English account of the social justice movement in Tamil Nadu.', 'Deeper', 'Social justice', true),
('அம்பேத்கர் – ஒரு வாழ்க்கை வரலாறு', 'கிஸ்டோஃபர் ஜெஃப்ரிலட்', 'சமூக நீதிக்காக போராடிய மாமனிதரின் கதை.', 'Beginner', 'Biography', true),
('Tamil Nadu: The Land of Dravidian Politics', 'M.S.S. Pandian', 'Academic but accessible account of Tamil political history.', 'Deeper', 'Politics', true),
('Why I Am a Hindu', 'Shashi Tharoor', 'A modern, rational look at Indian religion and politics.', 'Beginner', 'Philosophy', true)
ON CONFLICT DO NOTHING;

-- ---------- 5. Verify counts ----------
SELECT
  (SELECT COUNT(*) FROM public.yw_members) AS members,
  (SELECT COUNT(*) FROM public.yw_member_ids) AS member_ids,
  (SELECT COUNT(*) FROM public.yw_feeds WHERE status='published') AS published_feeds,
  (SELECT COUNT(*) FROM public.yw_podcast_episodes WHERE published=true) AS podcast_episodes,
  (SELECT COUNT(*) FROM public.yw_books WHERE published=true) AS books;
