// Loading an image

window.onload = function () {
	var canvas = document.getElementById('origin');
	var context = canvas.getContext('2d');

	make_base();

	function make_base() {
		base_image = new Image(300, 150);
		base_image.crossOrigin = "Anonymous";
		base_image.onload = function () {
			context.drawImage(base_image, 0, 0, base_image.width, base_image.height);
			data = context.getImageData(10, 10, 1, 1);
		}
		base_image.src = 'C:/Users/branc/Pictures/Mine/yellow.jpg';
	}

};