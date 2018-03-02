// Loading an image

var sourceImg = "../images/test.png"

// origin image struct
var origin = {
	img: new Image(),

	// draw image in the canvas. parameters are the offset
	drawImage: function (x = 0, y = 0) {
		var maxWidth = $("#origin").width();
		var maxHeight = $("#origin").height();

		var ratio = Math.min(maxWidth / this.img.width,
			maxHeight / this.img.height);
		this.context.drawImage(this.img, x, y,
			this.img.width * ratio, this.img.height * ratio);
	},

	getImageData: function (x = 0, y = 0) {
		flatData = this.context.getImageData(x, y, this.canvas.width(), this.canvas.height());

		data = []
		for (var i = 0; i < flatData.data.length; i += 4) {
			pixel = {}
			pixel.r = flatData.data[i];
			pixel.g = flatData.data[i + 1];
			pixel.b = flatData.data[i + 2];
			pixel.a = flatData.data[i + 3];

			data.push(pixel);
		}

		return data;

	}
}

$(document).ready(function () {
	origin.canvas = $("#origin");
	origin.context = origin.canvas[0].getContext('2d');

	make_base();

	function make_base() {

		origin.img.onload = function () {
			// draw image in canvas
			origin.drawImage();

			// get image array
			data = origin.getImageData();
			pixel = data[0];
		}

		origin.img.src = sourceImg;
	}
});