-- Dữ liệu mẫu để demo (không chứa mật khẩu; tài khoản admin do ứng dụng tạo từ biến môi trường).

INSERT INTO books (isbn, title, author, publisher, publish_year, category, total_copies, available_copies) VALUES
 ('978-604-00-0001-1', 'Dế Mèn phiêu lưu ký',                      'Tô Hoài',              'NXB Kim Đồng',            2019, 'Văn học thiếu nhi',   4, 4),
 ('978-604-00-0002-2', 'Số đỏ',                                    'Vũ Trọng Phụng',       'NXB Văn học',             2018, 'Văn học Việt Nam',    3, 3),
 ('978-604-00-0003-3', 'Truyện Kiều',                              'Nguyễn Du',            'NXB Văn học',             2017, 'Văn học Việt Nam',    5, 5),
 ('978-604-00-0004-4', 'Tắt đèn',                                  'Ngô Tất Tố',           'NXB Văn học',             2016, 'Văn học Việt Nam',    3, 3),
 ('978-604-00-0005-5', 'Nhà giả kim',                              'Paulo Coelho',         'NXB Văn học',             2020, 'Văn học nước ngoài',  4, 4),
 ('978-604-00-0006-6', 'Clean Code',                               'Robert C. Martin',     'Prentice Hall',           2008, 'Công nghệ thông tin', 3, 3),
 ('978-604-00-0007-7', 'Introduction to Algorithms',               'Thomas H. Cormen',     'MIT Press',               2022, 'Công nghệ thông tin', 2, 2),
 ('978-604-00-0008-8', 'Designing Data-Intensive Applications',    'Martin Kleppmann',     'O''Reilly Media',         2017, 'Công nghệ thông tin', 3, 3),
 ('978-604-00-0009-9', 'Sapiens: Lược sử loài người',              'Yuval Noah Harari',    'NXB Tri thức',            2018, 'Lịch sử',             3, 3),
 ('978-604-00-0010-0', 'Đắc nhân tâm',                             'Dale Carnegie',        'NXB Tổng hợp TP.HCM',     2016, 'Kỹ năng sống',        5, 5),
 ('978-604-00-0011-1', 'Lược sử thời gian',                        'Stephen Hawking',      'NXB Trẻ',                 2018, 'Khoa học',            2, 2),
 ('978-604-00-0012-2', 'Site Reliability Engineering',             'Betsy Beyer (chủ biên)', 'O''Reilly Media',       2016, 'Công nghệ thông tin', 2, 2);

INSERT INTO members (member_code, full_name, email, phone, address, status) VALUES
 ('DG0001', 'Nguyễn Văn An',   'an.nguyen@example.com',   '0901000001', 'Lê Chân, Hải Phòng',       'active'),
 ('DG0002', 'Trần Thị Bình',   'binh.tran@example.com',   '0901000002', 'Ngô Quyền, Hải Phòng',     'active'),
 ('DG0003', 'Lê Minh Châu',    'chau.le@example.com',     '0901000003', 'Hồng Bàng, Hải Phòng',     'active'),
 ('DG0004', 'Phạm Quốc Dũng',  'dung.pham@example.com',   '0901000004', 'Kiến An, Hải Phòng',       'active'),
 ('DG0005', 'Hoàng Thu Hà',    'ha.hoang@example.com',    '0901000005', 'Hải An, Hải Phòng',        'suspended'),
 ('DG0006', 'Vũ Đức Huy',      'huy.vu@example.com',      '0901000006', 'Dương Kinh, Hải Phòng',    'active'),
 ('DG0007', 'Đặng Mai Lan',    'lan.dang@example.com',    '0901000007', 'Đồ Sơn, Hải Phòng',        'active'),
 ('DG0008', 'Bùi Thanh Tùng',  'tung.bui@example.com',    '0901000008', 'An Dương, Hải Phòng',      'active');

-- Phiếu mượn mẫu (có phiếu quá hạn và phiếu đã trả để dashboard có dữ liệu)
INSERT INTO loans (book_id, member_id, borrowed_at, due_date, returned_at) VALUES
 (6, 1, CURRENT_DATE - 30, CURRENT_DATE - 16, NULL),             -- quá hạn
 (5, 4, CURRENT_DATE - 20, CURRENT_DATE - 6,  NULL),             -- quá hạn
 (8, 2, CURRENT_DATE - 10, CURRENT_DATE + 4,  NULL),             -- còn hạn
 (1, 3, CURRENT_DATE - 5,  CURRENT_DATE + 9,  NULL),             -- còn hạn
 (10, 6, CURRENT_DATE - 3, CURRENT_DATE + 11, NULL),             -- còn hạn
 (3, 2, CURRENT_DATE - 40, CURRENT_DATE - 26, CURRENT_DATE - 28),-- đã trả
 (7, 7, CURRENT_DATE - 25, CURRENT_DATE - 11, CURRENT_DATE - 12);-- đã trả

-- Đồng bộ số bản còn lại = tổng số bản - số phiếu chưa trả
UPDATE books b
   SET available_copies = b.total_copies - (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.returned_at IS NULL);
