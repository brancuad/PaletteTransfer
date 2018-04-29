// Loading an image

var rgbString = function (rgba) {
	return "rgb(" + parseInt(rgba[0]) + ", " + parseInt(rgba[1]) + ", " + parseInt(rgba[2]) + ")"
}

var stringtoRgb = function (rgbString) {
	var rgb = rgbString.replace(/[^\d,]/g, '').split(',');

	for (var i in rgb) {
		rgb[i] = parseInt(rgb[i]);
	}

	return rgb;

}

// Check if lab color is out of gamut
var labOutOfGamut = function (C, L) {
	C = [L, C[0], C[1]]

	if ((C[0] >= 100 || C[0] <= 0)
		|| (C[1] >= 128 || C[1] <= -128)
		|| (C[2] >= 128 || C[2] <= -128))
		return true;

	C_rgb = lab2rgb(C);

	var outOfBounds = false;

	// Check if all bounds have been reached
	if ((C_rgb[0] >= 255 || C_rgb[0] <= 0)
		&& (C_rgb[1] >= 255 || C_rgb[1] <= 0)
		&& (C_rgb[2] >= 255 || C_rgb[2] <= 0))
		return true;


	for (var i in C_rgb) {
		var val = C_rgb[i];

		if (val < 0 || val > 255 || isNaN(val)) {
			outOfBounds = true;
			break;
		}
	}

	return outOfBounds;
}

// Get color Cb in Lab color space
// Where Lb = L and Cb is where the boundary of the gamut intersects
// The line between C and C_prime
// x is the optional starting point, using the slope of C to C_prime
var gamutIntersect = function (C, C_prime, L, x) {
	// Get slope from C to C_prime
	// (Cp_b - C_b) / (Cp_a - C_a)

	var db = (C_prime[1] - C[1]) / 10;
	var da = (C_prime[0] - C[0]) / 10;

	var outOfBounds = false;
	var prevColor = [0, 0];
	var currentColor = C.slice();

	if (x)
		currentColor = x.slice();

	while (outOfBounds == false) {
		// Store the previous color
		// This will be the intersect 
		// when the current color is out of bounds
		prevColor = currentColor.slice();

		// Get next color
		currentColor[0] = prevColor[0] + da;
		currentColor[1] = prevColor[1] + db;

		if (labOutOfGamut(currentColor, L)) {
			outOfBounds = true;
		}
	}

	// The last in-gamut color will be used
	C_b = prevColor;

	return C_b;

}

var showLoading = function () {
	$("#loading").show();
}

var hideLoading = function () {
	$("#loading").hide();
}

// origin image struct
var origin = {
	img: new Image(),
	paletteSize: 5,
	pixels: null,
	palette: null,
	weights: null,

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
			pixel = []
			pixel.push(flatData.data[i]);
			pixel.push(flatData.data[i + 1]);
			pixel.push(flatData.data[i + 2]);
			pixel.push(flatData.data[i + 3]);

			data.push(pixel);
		}

		return data;

	},

	// Plot histogram of bins
	// Return means of each bin in LAB color space
	getKmeansData: function () {

		// Get histogram of all the colors
		var colorArray = function () {
			var arr = [];
			for (var i = 0; i < 16; i++) {
				arr.push([]);
				for (var j = 0; j < 16; j++) {
					arr[i].push([]);
					for (var k = 0; k < 16; k++) {
						arr[i][j].push([]);
					}
				}
			}
			return arr;
		};

		var bins = colorArray();

		// Separate pixels into bins for each color channel
		for (var i = 0; i < this.pixels.length; i++) {

			pixel = this.pixels[i];

			var pBins = [];
			for (j in pixel) {
				pBins.push(Math.floor(pixel[j] / 16));
			}

			bins[pBins[0]][pBins[1]][pBins[2]].push(pixel);

		}

		// Get mean color per bin in lab color space
		var binMeans = colorArray();

		var labBins = colorArray();

		// Convert to lab and average all bins
		for (var i = 0; i < bins.length; i++) {
			for (var j = 0; j < bins[i].length; j++) {
				for (var k = 0; k < bins[i][j].length; k++) {
					bin = bins[i][j][k];

					labBin = []

					// Convert rgb pixels to lab
					for (var u = 0; u < bin.length; u++) {
						var lab = rgb2lab(bin[u]);
						labBin[u] = lab;
					}

					// Average lab values
					lTotal = 0;
					aTotal = 0;
					bTotal = 0;
					for (var u = 0; u < labBin.length; u++) {
						var labPixel = labBin[u];
						lTotal += labPixel[0];
						aTotal += labPixel[1];
						bTotal += labPixel[2];
					}

					if (bin.length > 0) {
						binMeans[i][j][k].push(lTotal / labBin.length);
						binMeans[i][j][k].push(aTotal / labBin.length);
						binMeans[i][j][k].push(bTotal / labBin.length);
					}

					labBins[i][j][k] = labBin;
				}
			}
		}

		var flattenBins = function (meansArray) {
			var arr = [];

			for (i in meansArray) {
				for (j in meansArray[i]) {
					for (k in meansArray[i][j]) {
						if (meansArray[i][j][k].length == 0) {
							continue;
						}
						arr.push(meansArray[i][j][k]);
					}
				}
			}

			return arr;
		}

		// Combine the mean points gathered from all of the bins
		var means = flattenBins(binMeans);


		// Calculate the starting centroids for kmeans
		var centroids = [];
		var usedBins = [];
		while (centroids.length < this.paletteSize) {
			// Get mean of largest bin
			var max_i; var max_j; var max_k; var maxSize = 0;
			for (var i = 0; i < labBins.length; i++) {
				for (var j = 0; j < labBins[i].length; j++) {
					for (var k = 0; k < labBins[i][j].length; k++) {
						var used = false;
						for (var bin in usedBins) {
							if (usedBins[bin][0] == i
								&& usedBins[bin][1] == j
								&& usedBins[bin][2] == k) {
								used = true;
								break;
							}
						}

						if (used)
							continue

						if (labBins[i][j][k].length > maxSize) {
							maxSize = labBins[i][j][k].length;
							max_i = i;
							max_j = j;
							max_k = k;
						}
					}
				}
			}

			centroids.push(binMeans[max_i][max_j][max_k]);

			usedBins.push([max_i, max_j, max_k]);
		}

		// Add black to centroids to filter out dark colors
		centroids.push([0.0, 0.0, 0.0])

		return {
			points: means,
			centroids: centroids
		};
	},

	getPalette: function () {

		var sortPalette = function (a, b) {
			if (a[0] == b[0]) {
				return 0;
			}

			else {
				return (a[0] < b[0]) ? -1 : 1;
			}
		}

		var data = origin.getKmeansData();
		var kmeansPoints = data.points;

		// The 6th cluster will always filter out the darkest cluster (closest to black)
		var kMeansResult = clusterfck.kmeans(kmeansPoints, this.paletteSize + 1, data.centroids);

		var centroids = kMeansResult.centroids.slice(0, this.paletteSize);

		centroids.sort(sortPalette);

		var palette = []
		for (var i = 0; i < centroids.length; i++) {
			palette.push(math.round(lab2rgb(centroids[i])));
		}

		return palette;

	},

	// Calculate weights for pixels now
	getWeights: function () {

		var weights = [];

		for (var i = 0; i < this.palette.length; i++) {

			var points = this.palette.slice();

			for (j in points) {
				points[j] = rgb2lab(points[j]);
			}

			var values = [];

			for (j in this.palette) {
				values.push(0.0);
			}

			values[i] = 1.0;

			var rbf = RBF(points, values, 'gaussian');

			weights.push(rbf);
		}

		return weights;
	},

	showPalette: function () {
		var palette = this.palette;

		labMin = 0;
		labMax = 100;

		$("input.color").remove();

		for (var i = 0; i < this.paletteSize; i++) {
			labMin = rgb2lab(palette[i])[0]

			if (i == this.paletteSize - 1) {
				labMax = 100
			}
			else {
				labMax = rgb2lab(palette[i + 1])[0]
			}

			var colorElement = $("<input></input>")
				.attr("id", "originColor" + (i + 1))
				.attr("type", "button")
				.addClass("color");

			$("#colorContainer").append(colorElement);



			colorElement.val(rgbString(palette[i]))
				.css("background-color", rgbString(palette[i]))
				.colorPicker({
				});

		}

	},

	recolor: function (newPalette) {
		var palette = this.palette.slice();

		var pixels = this.pixels.slice();

		var weigh = this.weights.slice();

		// Calculate sigma and lambda now
		// To avoid multiple calculations

		// Sigma = mean of distance between all pairs of colors in palette
		var distances = [];
		for (var i = 0; i < palette.length - 1; i++) {
			for (var j = i; j < palette.length - 1; j++) {
				var C1 = rgb2lab(palette[i]).slice(1, 3);
				var C2 = rgb2lab(palette[j + 1]).slice(1, 3);
				distances.push(math.distance(C1, C2));

			}
		}

		var sigma = math.mean(distances);

		var transferColor = function (x) {
			x_lab = rgb2lab(x);

			var transfer = function (i, x, lum) {
				// x uses only [a,b] values of lab color space
				var C = rgb2lab(palette[i]);
				var C_prime = rgb2lab(newPalette[i]);
				var C_prime_l = C_prime[0];
				var C_l = C[0];

				if (math.deepEqual(C, C_prime)) {
					return x;
				}

				x_ab = x.slice(1, 3);
				C = C.slice(1, 3);
				C_prime = C_prime.slice(1, 3);



				var L = C_l;

				var C_b = gamutIntersect(C, C_prime, L);

				var x_0 = [0, 0];

				x_0 = math.subtract(math.add(x_ab, C), C_prime);

				// near case
				if (labOutOfGamut(x_0, L)) {
					// Find where the line from C_prime to x_0
					// Intersects with the gamut boundary
					var x_b = gamutIntersect(C_prime, x_0, L);
				}
				// far case
				else {
					// Get x_b where x intersects the gamut boundary
					// Parallel to C - C_prime
					var x_b = gamutIntersect(C, C_prime, L, x_ab);

				}

				// Calculate x'
				var min_numerator = math.norm(math.subtract(x_b, x_ab));
				var min_denom = math.norm(math.subtract(C_b, C));

				var min_result = math.min(1, min_numerator / min_denom);

				// Find x' such that
				// ||x'-x|| = ||C'-C||*(min_result)
				var dist = math.norm(math.subtract(C_prime, C));

				var v = math.subtract(x_b, x_ab);
				var u = math.divide(v, math.norm(v));

				var x_prime = math.add(v, math.multiply(dist, u));

				// Return x', using the new color's luminance
				var result = [lum, x_prime[0], x_prime[1]];

				if (labOutOfGamut(x_prime, lum)) {
					result_ab = gamutIntersect(x_ab, x_prime, lum);
					result = [lum, result_ab[0], result_ab[1]];
				}

				return result;
			}

			var transfer_l = function (i, x, weights) {
				// Get closest palette
				var maxWeight = 0;
				var maxIndex = 0;
				for (j in weights) {
					if (weights[j] > maxWeight) {
						maxIndex_2 = maxIndex;
						maxWeight_2 = maxWeight;
						maxIndex = j;
						maxWeight = weights[j];
					}
				}


				var maxWeight_2 = 0;
				var maxIndex_2 = 0;
				for (j in weights) {
					if (j == maxIndex)
						continue;
					if (weights[j] > maxWeight_2) {
						maxIndex_2 = j;
						maxWeight_2 = weights[j];
					}
				}

				var closestColor = rgb2lab(palette[maxIndex]);

				var closestColor_2 = rgb2lab(palette[maxIndex_2]);

				var new_l = (closestColor[0] * (maxWeight)) +
					(closestColor_2[0] * (maxWeight_2)) +
					(x[0] * (1 - maxWeight - maxWeight_2));

				return x[0];
			}

			var total = [0, 0, 0];
			var weights = []
			for (i in palette) {
				weights.push[0.0]
			}

			for (var i in palette) {
				weights[i] = weigh[i](x_lab);

				if (weights[i] < 0)
					weights[i] = 0;
			}

			var reweigh = function (wArray) {
				var weightSum = math.sum(weights);

				// Re-normalize weights between 0 and 1
				for (var i = 0; i < weights.length; i++) {
					weights[i] = weights[i] / weightSum;

				}
			}

			reweigh(weights);

			var result_l = transfer_l(i, x_lab, weights);

			// Apply weights to result of transfer function
			for (var i in palette) {

				var f_result_ab = transfer(i, x_lab, result_l);

				total = math.add(total, math.multiply(weights[i], f_result_ab));
			}


			total = [result_l, total[1], total[2]];

			var newColor = math.round(lab2rgb(total));

			return newColor;

		};

		// Iterate through all pixels and transfer each color
		for (var i = 0; i < pixels.length; i++) {
			var pixel = pixels[i]

			var newColor = transferColor(pixel);

			pixels[i] = newColor;
		}

		return pixels;
	},

	flattenPixels: function (pixels) {
		data = []
		for (var i = 0; i < pixels.length; i++) {
			pixel = pixels[i]
			data.push(pixel[0]);
			data.push(pixel[1]);
			data.push(pixel[2]);
			data.push(pixel[3]);
		}

		return data;
	},

	getNewPalette: function () {
		newPalette = [];

		for (var i = 1; i <= this.paletteSize; i++) {
			var color = $("#originColor" + i).css("backgroundColor");
			var rgb = stringtoRgb(color);
			newPalette.push(rgb);
		}

		return newPalette;
	},
}

// output image struct
var output = {
	img: new Image(),
	pixels: null,
	palette: null,
	clusters: null,

	// draw image in the canvas. parameters are the offset
	drawImage: function (x = 0, y = 0) {
		var maxWidth = $("#output").width();
		var maxHeight = $("#output").height();

		var ratio = Math.min(maxWidth / this.img.width,
			maxHeight / this.img.height);
		this.context.drawImage(this.img, x, y,
			this.img.width * ratio, this.img.height * ratio);
	},

	getImageData: function (x = 0, y = 0) {
		flatData = this.context.getImageData(x, y, this.canvas.width(), this.canvas.height());

		data = []
		for (var i = 0; i < flatData.data.length; i += 4) {
			pixel = []
			pixel.push(flatData.data[i]);
			pixel.push(flatData.data[i + 1]);
			pixel.push(flatData.data[i + 2]);
			pixel.push(flatData.data[i + 3]);

			data.push(pixel);
		}

		return data;

	},

	putImageData: function (imgData, x = 0, y = 0) {
		this.context.putImageData(imgData, x, y);
	},

	getTransferData: function (pixels, x = 0, y = 0) {
		flatData = this.context.createImageData(this.canvas.width(), this.canvas.height());
		for (var i = 0; i < flatData.data.length; i += 4) {
			flatData.data[i + 0] = pixels[i + 0];
			flatData.data[i + 1] = pixels[i + 1];
			flatData.data[i + 2] = pixels[i + 2];
			flatData.data[i + 3] = 255;
		}

		return flatData;
	},
}

$(document).ready(function () {

	origin.canvas = $("#origin");
	output.canvas = $("#output");
	origin.context = origin.canvas[0].getContext('2d');
	output.context = output.canvas[0].getContext('2d');


	make_base();

	function make_base() {

		origin.img.onload = function () {
			// draw image in canvas
			origin.drawImage();

			$("#calc").mousedown(showLoading).mouseup(function () {

				// get image array
				origin.pixels = origin.getImageData();

				origin.paletteSize = $("input[name=kPicker]:checked").val();
				origin.palette = origin.getPalette();

				origin.weights = origin.getWeights();

				origin.showPalette();

				hideLoading();
			});

			$("#transfer").mousedown(showLoading).mouseup(function () {

				var recolorPixels = origin.recolor(origin.getNewPalette());

				// Use original pixels for now
				// var recolorPixels = origin.pixels;
				var flatPixels = origin.flattenPixels(recolorPixels);

				var imgData = output.getTransferData(flatPixels);

				output.putImageData(imgData);


				hideLoading();
			});
		}

		origin.img.src = $("#imgSelect").val();

		$("#imgSelect").change(function () {
			origin.img.src = $(this).val();
		});
	}
});