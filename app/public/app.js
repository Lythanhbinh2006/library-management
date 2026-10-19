// Xác nhận trước khi thực hiện thao tác xóa (không dùng inline script để tuân thủ CSP).
document.addEventListener('submit', function (event) {
  var message = event.target && event.target.getAttribute('data-confirm');
  if (message && !window.confirm(message)) {
    event.preventDefault();
  }
});
