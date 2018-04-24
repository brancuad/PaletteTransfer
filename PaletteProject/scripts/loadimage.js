// Loading an image

var sourceImg = "../images/sky.jpg"

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
	C_rgb = lab2rgb(C);

	var outOfBounds = false;

	// Check if all bounds have been reached
	if ((C_rgb[0] == 255 || C_rgb[0] == 0)
		&& C_rgb[1] == 255 || C_rgb[1] == 0
		&& C_rgb[2] == 255 || C_rgb[2] == 0)
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

	var db = (C_prime[1] - C[1]);
	var da = (C_prime[0] - C[0]);

	var outOfBounds = false;
	var prevColor = [0, 0];
	var currentColor = C.slice();

	if (x)
		currentColor = x.slice();

	while (outOfBounds == false) {
		// Store the previous color
		// This will be the intersect 
		// when the current color is out of bounds
		prevColor = currentColor;

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
		// Derived from https://billmill.org/the_histogram.html
		var colorArray = function () {
			arr = [];
			for (var i = 0; i < 16; i++) {
				arr[i] = []
			}
			return arr;
		};

		var rbins = colorArray();
		var gbins = colorArray();
		var bbins = colorArray();

		// Separate pixels into bins for each color channel
		for (var i = 0; i < this.pixels.length; i++) {
			var getBin = function (num) {
				return Math.floor(num / 16);
			}
			pixel = this.pixels[i];
			rbins[getBin(pixel[0])].push(pixel);
			gbins[getBin(pixel[1])].push(pixel);
			bbins[getBin(pixel[2])].push(pixel);
		}

		// Display histograms
		var histCtx = $("#originHist")[0].getContext('2d');
		var histCanvas = $("#originHist");

		var maxBinSize = function (bins) {
			var maxLength = 0;
			for (var i = 0; i < bins.length; i++) {
				var bin = bins[i];

				if (bin.length > maxLength) {
					maxLength = bin.length;
				}
			}

			return maxLength;
		}

		var rmax = maxBinSize(rbins);
		var gmax = maxBinSize(gbins);
		var bmax = maxBinSize(bbins);

		var colorbars = function (max, bins, color, y) {
			histCtx.fillStyle = color;
			jQuery.each(bins, function (i, x) {
				var pct = (bins[i].length / max) * 130;
				histCtx.fillRect(i * (histCanvas.width() / 16), y, 15, -Math.round(pct));
			});
		};

		colorbars(rmax, rbins, "rgb(255,0,0)", this.canvas.height() / 3);
		colorbars(gmax, gbins, "rgb(0,255,0)", 2 * this.canvas.height() / 3);
		colorbars(bmax, bbins, "rgb(0,0,255)", this.canvas.height());

		// Get mean color per bin in lab color space
		var rmeans = colorArray();
		var gmeans = colorArray();
		var bmeans = colorArray();

		var rlabBins = [];
		var blabBins = [];
		var glabBins = [];

		// Convert to lab and average all bins
		for (var i = 0; i < rbins.length; i++) {
			rbin = rbins[i];
			gbin = gbins[i];
			bbin = bbins[i];

			rlabBin = []
			glabBin = []
			blabBin = []

			// Convert rgb pixels to lab
			for (var j = 0; j < rbin.length; j++) {
				var rlab = rgb2lab(rbin[j]);
				rlabBin[j] = rlab;
			}

			// Average rlab values
			lTotal = 0;
			aTotal = 0;
			bTotal = 0;
			for (var j = 0; j < rlabBin.length; j++) {
				var labPixel = rlabBin[j];
				lTotal += labPixel[0];
				aTotal += labPixel[1];
				bTotal += labPixel[2];
			}

			if (rbin.length > 0) {
				rmeans[i].push(lTotal / rlabBin.length);
				rmeans[i].push(aTotal / rlabBin.length);
				rmeans[i].push(bTotal / rlabBin.length);
			}

			// Convert and average green bin
			for (var j = 0; j < gbin.length; j++) {
				var glab = rgb2lab(gbin[j]);
				glabBin[j] = glab;
			}

			lTotal = 0;
			aTotal = 0;
			bTotal = 0;
			for (var j = 0; j < glabBin.length; j++) {
				var labPixel = glabBin[j];
				lTotal += labPixel[0];
				aTotal += labPixel[1];
				bTotal += labPixel[2];
			}

			if (gbin.length > 0) {
				gmeans[i].push(lTotal / glabBin.length);
				gmeans[i].push(aTotal / glabBin.length);
				gmeans[i].push(bTotal / glabBin.length);


			}

			// Convert and average blue bin
			for (var j = 0; j < bbin.length; j++) {
				var blab = rgb2lab(bbin[j]);
				blabBin[j] = blab;
			}

			lTotal = 0;
			aTotal = 0;
			bTotal = 0;
			for (var j = 0; j < blabBin.length; j++) {
				var labPixel = blabBin[j];
				lTotal += labPixel[0];
				aTotal += labPixel[1];
				bTotal += labPixel[2];
			}

			if (bbin.length > 0) {
				bmeans[i].push(lTotal / blabBin.length);
				bmeans[i].push(aTotal / blabBin.length);
				bmeans[i].push(bTotal / blabBin.length);
			}

			rlabBins.push(rlabBin);
			glabBins.push(glabBin);
			blabBins.push(blabBin);

		}

		var removeEmpty = function (meansArray) {
			var arr = [];

			for (var i = 0; i < meansArray.length; i++) {
				if (meansArray[i].length == 0)
					continue;
				arr.push(meansArray[i]);
			}

			return arr;
		}

		// Combine the mean points gathered from all of the bins
		var means = [];

		means = means.concat(removeEmpty(rmeans));
		means = means.concat(removeEmpty(gmeans));
		means = means.concat(removeEmpty(bmeans));

		// Calculate the starting centroids for kmeans
		var centroids = [];
		var usedBins = [];
		while (centroids.length < 5) {
			// Get mean of largest bin
			var labBins = [rlabBins, glabBins, blabBins];
			var max_i; var max_j; var maxSize = 0;
			for (var i = 0; i < labBins.length; i++) {
				for (var j = 0; j < labBins[i].length; j++) {

					var used = false;
					for (var bin in usedBins) {
						if (usedBins[bin][0] == i && usedBins[bin][1] == j) {
							used = true;
							break;
						}
					}

					if (used)
						continue

					if (labBins[i][j].length > maxSize) {
						maxSize = labBins[i][j].length;
						max_i = i;
						max_j = j;
					}
				}
			}

			if (max_i == 0) {
				centroids.push(rmeans[max_j]);
			}
			else if (max_i == 1) {
				centroids.push(gmeans[max_j]);
			}
			else {
				centroids.push(bmeans[max_j]);
			}

			usedBins.push([max_i, max_j]);

			// TODO: Attenuate size of bins
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
		var kMeansResult = clusterfck.kmeans(kmeansPoints, 6, data.centroids);

		var centroids = kMeansResult.centroids.slice(0, 5);

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

			var values = [0.0, 0.0, 0.0, 0.0, 0.0];
			values[i] = 1.0;

			var rbf = RBF(points, values, 'gaussian');

			weights.push(rbf);
		}

		return weights;
	},

	showPalette: function () {
		var palette = this.palette;

		for (var i = 0; i < 5; i++) {
			$("#originColor" + (i + 1)).css({
				backgroundColor: rgbString(palette[i])
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

			/*
			var weigh = function (i, x) {

				// Gaussian Kernel
				var phi = function (r) {
					var exp_input = math.divide(-1 * math.square(r),
						2 * math.square(sigma));

					return math.exp(exp_input);
				};

				var weightTotal = 0;

				for (var j in palette) {
					var lambda = 0;
					if (j == i)
						lambda = 1;
					else
						lambda = Math.random(0, 1);

					// Use only the ab values of the color
					C_j = rgb2lab(palette[j]);

					var phi_input = math.norm(math.subtract(x, C_j));

					weightTotal += lambda * phi(phi_input);
				}

				return weightTotal;
			}
			*/

			var transfer = function (i, x) {
				// x uses only [a,b] values of lab color space
				var C = rgb2lab(palette[i]);
				var C_prime = rgb2lab(newPalette[i]);

				if (math.deepEqual(C, C_prime))
					return x;

				x_ab = x.slice(1, 3);
				C = C.slice(1, 3);
				C_prime = C_prime.slice(1, 3);



				var L = rgb2lab(newPalette[i])[0];

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
				return [x[0], x_prime[0], x_prime[1]];
			}
			
			var total = [0, 0, 0];
			var weights = [0, 0, 0, 0, 0];
			for (var i in palette) {
				weights[i] = weigh[i](x_lab);

				if (weights[i] < 0)
					weights[i] = 0;
			}

			var weightSum = math.sum(weights);

			// Re-normalize weights between 0 and 1
			for (var i = 0; i < weights.length; i++) {
				weights[i] = weights[i] / weightSum;
			}

			// Apply weights to result of transfer function
			for (var i in palette) {

				var f_result = transfer(i, x_lab);

				total = math.add(total, math.multiply(weights[i], f_result));
			}

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

	getNewPalette: function () {
		newPalette = [];

		for (var i = 1; i <= 5; i++) {
			var color = $("#originColor" + i).css("backgroundColor");
			var rgb = stringtoRgb(color);
			newPalette.push(rgb);
		}

		return newPalette;
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

				origin.palette = origin.getPalette();

				origin.weights = origin.getWeights();

				origin.showPalette();

				hideLoading();
			});

			$("#transfer").mousedown(showLoading).mouseup(function () {
				
				var recolorPixels = origin.recolor(output.getNewPalette());

				// Use original pixels for now
				// var recolorPixels = origin.pixels;
				var flatPixels = origin.flattenPixels(recolorPixels);

				var imgData = output.getTransferData(flatPixels);

				output.putImageData(imgData);


				hideLoading();
			});
		}

		origin.img.src = sourceImg;
	}
});